# Shared Project Progress Tracking

This project uses a small project-local hook system to keep AI coding work tied to a persistent
progress log. The goal is simple: every new task starts with the current project state, and every
completed task leaves a concise Korean record of what changed — **including which LLM did the work**.

The tracking is **shared across tools**: Codex CLI and Claude Code both read and update the same
`progress.md` at the project root, using the same hook script with a different `--tool` value.

## Files

- `progress.md` (project root): Shared, human-readable progress log and current state. **Single source of truth for both tools.**
- `.codex/hooks/progress_hook.py`: Cross-platform, tool-agnostic hook for `SessionStart`, `UserPromptSubmit`, and `Stop`.
- `.codex/hooks/test_progress_hook.py`: Standard-library local tests for the hook.
- `.codex/hooks.json`: Codex CLI hook registration (invokes the hook with `--tool codex`).
- `.claude/settings.json`: Claude Code hook registration (invokes the same hook with `--tool claude-code`).
- `.codex/.progress_state.<tool>.json`: Per-tool turn baseline (e.g. `.progress_state.codex.json`, `.progress_state.claude-code.json`). Keeping these separate lets each tool track its own turn without colliding.
- `AGENTS.md` / `CLAUDE.md`: Repository instructions requiring each tool to read and update the shared progress log.

## Hook Behavior

- `SessionStart`: Ensures `progress.md` exists, reads the current state and recent task log entries, and returns compact additional context (understood by both Codex and Claude Code).
- `UserPromptSubmit`: Records the submitted prompt as the active task, **stamps `Active LLM` with the invoking tool**, stores a per-tool turn baseline, and reminds the agent to consider the current progress state.
- `Stop`: Checks whether `progress.md` was updated after the current turn began and that the newly added content contains Korean text. If either check fails (and this is not a stop-hook reentry), it returns a blocking JSON decision so the agent continues and records the completed work in Korean, with the LLM field filled in.

The hook does not depend on transcript file format. Any transcript path provided by the tool is
optional diagnostic information only.

## The LLM field

Each Task Log entry carries an `LLM:` field naming the tool/model that performed the work
(`Codex CLI` or `Claude Code`). The value is also stamped deterministically into `Current State`
(`Active LLM`) on every prompt submission, so the record is reliable regardless of what the model writes.

## Windows Verification

Run the local tests from the repository root:

```powershell
py -3 .codex\hooks\test_progress_hook.py
```

If `py -3` is unavailable, use:

```powershell
python .codex\hooks\test_progress_hook.py
```

## Hook Trust Review

Codex CLI may ask you to review or trust project-local hooks before they run. Review
`.codex/hooks.json` and `.codex/hooks/progress_hook.py`; the progress hook only reads stdin JSON
and writes files under the project directory (`progress.md` and `.codex/.progress_state.*.json`).
Claude Code loads its hooks from `.claude/settings.json`; changes there take effect on the next
Claude Code session.

## Temporary Disable

To temporarily disable progress tracking for a tool, edit that tool's registration
(`.codex/hooks.json` for Codex, `.claude/settings.json` for Claude Code) and remove or comment out
the `progress_hook.py` entries. Keep the file valid JSON if you edit it manually.

## Manual Progress Entry Example

Append completed work under `## Task Log` using this format. Keep the field labels, write the values
in Korean, and set `LLM` to the tool you used:

```markdown
### 2026-07-03 14:30 KST
- Task: 진행상황 추적 훅 구현.
- LLM: Claude Code
- Summary: 작업 종료 전 한국말 진행상황 기록을 요구하는 프로젝트 로컬 훅을 추가했다.
- Files changed: CLAUDE.md, .claude/settings.json, .codex/hooks/progress_hook.py, progress.md
- Checks run: py -3 .codex\hooks\test_progress_hook.py
- Result: 통과.
- Open issues: 없음.
- Next: 다음 작업에서 실제 훅 실행을 확인한다.
```
