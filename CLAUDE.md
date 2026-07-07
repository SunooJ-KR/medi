# Repository Instructions (Claude Code)

If the prompt ends with `>N` (e.g., >1, >2, >3), answer within N lines.

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

## Task Board & Commit Rules

`progress.md` is also the task board for the development plan in `strategies/dev-plan.md`.
It has three status sections: **현재 진행 중** (in progress), **다음 단계** (next), **완료사항** (done).

- Unit tasks are defined in `strategies/dev-plan.md` (deliverables, done criteria, dependencies).
  `progress.md` only tracks their status — plan changes go to `strategies/dev-plan.md` first.
- When starting a unit task: move it from 다음 단계 to 현재 진행 중. Only start tasks whose
  dependencies are complete.
- When finishing a unit task: verify its done criteria, move it to 완료사항 with the date,
  append a Task Log entry, and **make a git commit** — one unit task = one commit.
  Commit message format: `[{작업번호}] {요약}` (e.g. `[1-2] concerns 스키마 설계`).
  The commit must include the task's deliverables and the `progress.md` update together.
- Do not commit mid-task.

### How it is enforced

Hooks in `.claude/settings.json` run `.codex/hooks/progress_hook.py` with `--tool claude-code`:

- `SessionStart` injects the current progress state as context.
- `UserPromptSubmit` records the active task and stamps `Active LLM: Claude Code`, and stores a
  per-tool turn baseline in `.codex/.progress_state.claude-code.json`.
- `Stop` blocks completion until `progress.md` has a fresh Korean entry added during the turn.

The same hook script also serves Codex CLI (via `.codex/hooks.json`, `--tool codex`), so both
tools track into the one shared log with their own baseline state files.
