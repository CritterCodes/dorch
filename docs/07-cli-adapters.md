# 07 — CLI Adapters

## Overview

Each CLI adapter is responsible for three things:
1. Starting the CLI agent as a child process with the correct arguments and working directory
2. Stopping the process cleanly (SIGTERM → SIGKILL)
3. Formatting the context object into whatever the CLI expects as input

All adapters must export the same interface so the Executor can treat them interchangeably.

---

## Adapter Interface Contract

Every adapter must export these three functions:

```
start(context: ContextObject) → { process: ChildProcess, stdout: Readable, stderr: Readable }

stop(proc: ChildProcess) → Promise<void>
  // Sends SIGTERM. Resolves when process exits or after killTimeoutMs, whichever comes first.
  // Sends SIGKILL if still running after killTimeoutMs.

formatContext(context: ContextObject) → string
  // Returns the formatted context string to be injected into the CLI.
  // Used internally by start() — also exported for testing.
```

The `ContextObject` shape (returned by `memory.assembleContext(slug)` with `slug` added by the Executor before passing to the adapter):

```
{
  slug: string,             // project slug — used by adapter to construct cwd and temp file paths
  projectBrief: string,     // projects/<slug>/memory/project-brief.md
  projectSummary: string,   // projects/<slug>/memory/project-summary.md
  currentSprint: string,    // projects/<slug>/memory/current-sprint.md
  currentTask: string,      // projects/<slug>/memory/current-task.md
  latestHandoff: string,    // projects/<slug>/memory/latest-handoff.md (trimmed to 4800 chars)
  isFirstRun: boolean       // true if latestHandoff contains "No prior handoff"
}
```

The return value of `start()` must expose `stdout` and `stderr` as separate readable streams. Do not merge them inside the adapter — the Monitor needs them separate for source tagging.

---

## Context Injection Strategy

How each CLI accepts input varies. The adapter must handle the translation. Two general approaches:

**Option A — Temp file:**
Write the formatted context to a temp file (e.g. `/tmp/orch-context-<timestamp>.md`), pass the file path as a CLI argument. Delete the file after the agent process exits.

**Option B — Stdin pipe:**
Pipe the formatted context string to the process's stdin immediately after spawn, then close stdin.

Use whichever method the CLI reliably supports. If the CLI ignores stdin, use a temp file. If the CLI does not support file arguments, use stdin.

---

## codex.adapter.js

### What codex-cli expects

Codex CLI (OpenAI's Codex CLI tool) is typically invoked as:
```
codex [options] "<prompt>"
```

It reads a prompt string as a positional argument or from a flag. It operates on the current working directory.

### Context format for codex-cli

The formatted context string should follow this structure:

```
PROJECT:
<projectBrief>

PROJECT SUMMARY:
<projectSummary>

SPRINT PLAN:
<currentSprint>

CURRENT TASK:
<currentTask>

HANDOFF FROM PREVIOUS AGENT:
<latestHandoff>

---
You are a coding agent working on the repository in the current directory.
Read the above context carefully before making any changes.
Begin with the "### Next Step" from the handoff (or task 1 of the sprint plan if no prior handoff).
Do not modify files outside the scope of the current task.
Emit progress to stdout as you work.
When the current task is complete, output: STEP COMPLETE.
```

### Spawn command

```js
spawn('codex', ['--prompt', formattedContext], {
  cwd: path.join('projects', slug, 'workspace'),
  env: { ...process.env },
})
```

Adjust flags based on actual codex-cli version installed. Run `codex --help` on the VPS to confirm the correct flag for prompt input.

### Notes

- codex-cli may require `OPENAI_API_KEY` in environment — ensure this is set in the VPS environment or `.env` file loaded before spawn
- If codex-cli does not support a `--prompt` flag, use stdin injection or a temp file passed via `--file`

---

## claude.adapter.js

### What claude-cli expects

Claude CLI (Anthropic's `claude` CLI tool) is typically invoked as:
```
claude [options]
```

It accepts a prompt via stdin or a `--prompt` / `-p` flag depending on version. It operates on files in the current directory when given appropriate tool access flags.

### Context format for claude-cli

Same structure as codex, with one addition — Claude responds well to an explicit role framing at the top:

```
You are a coding agent. You have been handed off a task mid-progress.
Read the full context below and continue from where the previous agent stopped.

PROJECT:
<projectBrief>

PROJECT SUMMARY:
<projectSummary>

SPRINT PLAN:
<currentSprint>

CURRENT TASK:
<currentTask>

HANDOFF FROM PREVIOUS AGENT:
<latestHandoff>

---
Work on the repository in the current directory.
Start from "### Next Step" in the handoff.
Do not modify files outside the current task scope.
Output progress to stdout as you work.
When the current task is complete, output: STEP COMPLETE.
```

### Spawn command

```js
spawn('claude', ['-p', formattedContext, '--allowedTools', 'Bash,Edit,Write'], {
  cwd: path.join('projects', slug, 'workspace'),
  env: { ...process.env },
})
```

Adjust `--allowedTools` based on what the installed claude-cli version supports. At minimum, the agent needs file read/write and shell execution access.

### Notes

- claude-cli may require `ANTHROPIC_API_KEY` in environment
- Some versions of claude-cli use `--print` instead of `-p` — confirm on the VPS
- If the context string is very long, prefer the temp file approach to avoid shell argument length limits

---

## Shared stop() Implementation

Both adapters should use the same stop logic. Consider extracting to `agents/shared.js`:

```js
async function stopProcess(proc, killTimeoutMs) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
    }, killTimeoutMs);
    proc.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
    proc.kill('SIGTERM');
  });
}
```

---

## Verifying an Adapter Works

Before wiring an adapter into the full orchestrator, test it standalone:

1. Create a minimal test script that calls `adapter.start(testContext)` directly
2. Pipe stdout/stderr to `process.stdout`
3. Confirm the agent starts, receives context, and emits output
4. Call `adapter.stop(proc)` after 10 seconds and confirm clean exit

Do this for both adapters before running the full orchestrator. Agent CLI behavior varies significantly by version and platform — do not assume the spawn flags work without testing.

---

## Error Handling in Adapters

- If `spawn` throws (command not found, permission denied), the adapter must catch and emit an `error` event on the bus: `{ type: 'adapter_error', adapter: 'codex-cli', message: err.message }`
- If the process exits immediately (exit code 1, no output), the Monitor will catch this as `process_error` — the adapter does not need to handle it separately
- Temp files created for context injection must be cleaned up in a `close` listener on the process — do not leave temp files on disk

---

## Future Adapters

To add a new agent (e.g. `gemini-cli`, `aider`, `continue`):

1. Create `agents/<name>.adapter.js`
2. Implement `start()`, `stop()`, `formatContext()` per the interface above
3. Determine how the CLI accepts a prompt (flag, stdin, config file)
4. Test standalone before integrating
5. Add the adapter name to `config.agents`

No other files need to change.
