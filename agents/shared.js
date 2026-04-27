import { config } from '../config.js';

export function commandName(base) {
  return process.platform === 'win32' ? `${base}.cmd` : base;
}

export async function stopProcess(proc, killTimeoutMs = config.killTimeoutMs) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode !== null || proc.killed) {
      resolve();
      return;
    }
    const timer = setTimeout(() => proc.kill('SIGKILL'), killTimeoutMs);
    proc.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
    proc.kill('SIGTERM');
  });
}

export function executorPrompt(context) {
  return `You are a coding agent working autonomously on a software project.
You have been given project context, a sprint plan, a current task, and a handoff from the previous agent.
Follow the sprint plan. Complete the current task. Do not modify files outside the current task's scope.

---

PROJECT:
${context.projectBrief}

---

PROJECT SUMMARY:
${context.projectSummary}

---

SPRINT PLAN:
${context.currentSprint}

---

CURRENT TASK:
${context.currentTask}

---

HANDOFF FROM PREVIOUS AGENT:
${context.latestHandoff}

---

INSTRUCTIONS:
- Read the handoff carefully. Start from "### Next Step" in the handoff.
- If this is the first run, start from task 1 of the sprint plan.
- Work only on files relevant to the current task.
- Run tests after making changes.
- When the current task is fully complete and tests pass, output exactly: STEP COMPLETE
- If you are blocked, output: BLOCKED: <reason>
`;
}
