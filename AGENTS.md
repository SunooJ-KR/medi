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
