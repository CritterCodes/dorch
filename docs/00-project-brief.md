# 00 — Project Brief

## What This Is

A Node.js orchestrator that runs on a VPS and coordinates multiple AI coding agents (initially Codex CLI and Claude CLI) against a single shared task. Dorch manages task state, detects when an agent is blocked, and switches to another agent without losing progress.

## The Problem Being Solved

Codex CLI and Claude CLI both hit rate limits, have unpredictable stalls, and sometimes crash mid-task. When that happens manually, the user has to restart from scratch or reconstruct context. This system removes that manual recovery step by automating handoffs between agents so work continues uninterrupted.

## Core Mechanism

- A single **task** is broken into steps by a Planner
- An **Executor** spawns the selected CLI agent as a child process
- A **Monitor** watches stdout/stderr in real time for blocking conditions
- A **Switch Controller** stops the current agent and starts the next one when triggered
- A **Handoff Manager** writes a structured summary to disk before each switch
- The next agent is started with the handoff + global plan as its context — no reliance on prior chat history
- A **mobile web UI** lets the user observe and override from a phone

## What "Done" Looks Like for MVP

- User submits a task via mobile UI or CLI
- Dorch breaks it into steps and writes to `memory/`
- First agent (codex-cli or claude-cli) starts automatically
- If that agent hits a rate limit, stalls, or crashes, Dorch detects it within ~45 seconds and switches
- The new agent picks up from the handoff file
- User can see live logs and trigger a manual switch at any time
- At task completion, user is notified

## What Is Not in Scope for MVP

- Multi-project or multi-workspace support
- Database-backed memory (use markdown files)
- Parallel agent execution
- Automated code review
- GitHub PR creation
- Cost tracking or model selection logic
- Polished UI

## Stack

- Runtime: Node.js (v20+)
- Agent execution: child_process (spawn, not exec)
- Memory: markdown files on disk
- Web UI: minimal HTML/JS, served by the same Node process
- Deployment: single VPS, single repo

## Key Constraint

Dorch must never block on agent output. All agent I/O must be handled via streams. The system must be able to kill and restart an agent at any point without deadlocking.
