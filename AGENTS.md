# Repository Instructions

## Shared Progress Tracking

- The progress log is a single shared file at the project root: `progress.md`.
  It is used by both Codex CLI and Claude Code — do not create tool-specific copies.
- Before starting any task, read `progress.md`.
- Review the current task, active LLM, pending issues, next recommended step, and recent changes before working.
- Before ending a task, update `progress.md` by appending a `## Task Log` entry.
- Keep entries concise, fact-based, and written in Korean.
- Every entry must include: Task, **LLM** (which tool/model did the work — here, `Codex CLI`),
  Files changed, Checks run, Result, Open issues, and Next.
- The Stop hook blocks task completion until `progress.md` has a fresh Korean entry for the turn.
