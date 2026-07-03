# Repository Instructions (Claude Code)

## Shared Progress Tracking

This project keeps a single shared progress log at the project root: `progress.md`.
It is shared with Codex CLI — both tools read and update the same file. Do not create a
separate `.claude/progress.md`.

- Before starting any task, read `progress.md` and review the Current State, active LLM,
  pending issues, next recommended step, and recent Task Log entries.
- Before ending a task, append a `## Task Log` entry to `progress.md`.
- Keep entries concise, fact-based, and written in Korean.
- Every entry must include: Task, **LLM** (which tool/model did the work — here, `Claude Code`),
  Summary, Files changed, Checks run, Result, Open issues, and Next.

### How it is enforced

Hooks in `.claude/settings.json` run `.codex/hooks/progress_hook.py` with `--tool claude-code`:

- `SessionStart` injects the current progress state as context.
- `UserPromptSubmit` records the active task and stamps `Active LLM: Claude Code`, and stores a
  per-tool turn baseline in `.codex/.progress_state.claude-code.json`.
- `Stop` blocks completion until `progress.md` has a fresh Korean entry added during the turn.

The same hook script also serves Codex CLI (via `.codex/hooks.json`, `--tool codex`), so both
tools track into the one shared log with their own baseline state files.
