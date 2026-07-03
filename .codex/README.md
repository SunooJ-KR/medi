# Codex Project Progress Tracking

This project uses a small project-local hook system to keep Codex CLI work tied to a persistent progress log. The goal is simple: every new task starts with the current project state, and every completed task leaves a concise Korean record of what changed.

## Files

- `.codex/progress.md`: Human-readable progress log and current state.
- `.codex/hooks/progress_hook.py`: Cross-platform Python hook for `SessionStart`, `UserPromptSubmit`, and `Stop`.
- `.codex/hooks/test_progress_hook.py`: Standard-library local tests for the hook.
- `.codex/hooks.json`: Project-local Codex hook registration.
- `AGENTS.md`: Repository instructions requiring Codex to read and update the progress log.

## Hook Behavior

- `SessionStart`: Ensures `.codex/progress.md` exists, reads the current state and recent task log entries, and returns compact additional context for Codex.
- `UserPromptSubmit`: Records the submitted prompt as the active task, stores a turn baseline in `.codex/.progress_state.json`, and reminds Codex to consider the current progress state.
- `Stop`: Checks whether `.codex/progress.md` was updated after the current turn began. It also checks that the newly added progress content contains Korean text. If either condition fails and this is not a stop-hook reentry, it returns a blocking JSON decision so Codex continues and records the completed work in Korean.

The hook does not depend on transcript file format. Any transcript path provided by Codex should be treated as optional diagnostic information only.

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

Codex CLI may ask you to review or trust project-local hooks before they run. Review `.codex/hooks.json` and `.codex/hooks/progress_hook.py`; the progress hook only reads stdin JSON and writes files under the project `.codex` directory.

## Temporary Disable

To temporarily disable progress tracking, edit `.codex/hooks.json` and remove or comment out the `progress_hook.py` hook entries. Keep the file valid JSON if you edit it manually.

## Manual Progress Entry Example

Append completed work under `## Task Log` using this format. Keep the field labels if useful, but write the values in Korean:

```markdown
### 2026-07-03 14:30 KST
- Task: 진행상황 추적 훅 구현.
- Summary: 작업 종료 전 한국말 진행상황 기록을 요구하는 프로젝트 로컬 훅을 추가했다.
- Files changed: AGENTS.md, .codex/hooks.json, .codex/progress.md, .codex/hooks/progress_hook.py
- Checks run: py -3 .codex\hooks\test_progress_hook.py
- Result: 통과.
- Open issues: 없음.
- Next: 다음 Codex 작업에서 실제 훅 실행을 확인한다.
```
