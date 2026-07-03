#!/usr/bin/env python3
"""Shared project progress tracking hook for Codex CLI and Claude Code.

Handles SessionStart, UserPromptSubmit, and Stop-style events without relying on
transcript files. The hook reads JSON from stdin and never raises user-visible
tracebacks for missing fields.

The progress log is a single shared file at the project root (progress.md) so that
work done by either tool lands in the same place. The invoking tool is passed with
--tool (codex | claude-code) and is recorded so each entry shows which LLM did it.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any


KST = timezone(timedelta(hours=9), "KST")
PROGRESS_FILENAME = "progress.md"
CURRENT_FIELDS = (
    "Active task",
    "Active LLM",
    "Current branch",
    "Last known working state",
    "Pending issues",
    "Next recommended step",
)
TOOL_LABELS = {
    "codex": "Codex CLI",
    "claude-code": "Claude Code",
}
# The empty stub header shipped in PROGRESS_TEMPLATE. It is a format example, not a
# real logged entry, so it must never be counted as history.
TEMPLATE_ENTRY_HEADER = "### YYYY-MM-DD HH:mm KST"
PROGRESS_TEMPLATE = """# Project Progress Log

이 로그는 Codex CLI와 Claude Code가 함께 사용하는 공유 기록입니다.
두 도구 모두 작업을 시작하기 전에 이 파일을 읽고, 작업을 끝내기 전에 갱신합니다.

## Current State
- Active task:
- Active LLM:
- Current branch:
- Last known working state:
- Pending issues:
- Next recommended step:

## Task Log

Each completed task should append a NEW entry at the end of this section, in the
format below. Never overwrite the file or delete existing entries — always append.
Write the values in Korean, and record which LLM/tool did the work in the LLM field.

### YYYY-MM-DD HH:mm KST
- Task:
- LLM:
- Summary:
- Files changed:
- Checks run:
- Result:
- Open issues:
- Next:
"""


def tool_label(tool: str) -> str:
    return TOOL_LABELS.get((tool or "").strip().lower(), (tool or "unknown").strip() or "unknown")


def read_payload() -> dict[str, Any]:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return {}
        value = json.loads(raw)
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def resolve_cwd(payload: dict[str, Any]) -> Path:
    cwd = payload.get("cwd")
    if isinstance(cwd, str) and cwd.strip():
        start = Path(cwd).expanduser().resolve()
    else:
        start = Path.cwd().resolve()

    current = start
    while True:
        # Anchor on markers unique to THIS project. Do not anchor on .claude/settings.json:
        # it also exists in the user home dir and would resolve the wrong root.
        if (current / PROGRESS_FILENAME).exists() or (current / ".codex" / "hooks" / "progress_hook.py").exists():
            return current
        if current.parent == current:
            return start
        current = current.parent


def paths(cwd: Path, tool: str) -> tuple[Path, Path]:
    """Return (shared progress.md at root, per-tool baseline state file)."""
    safe_tool = re.sub(r"[^a-z0-9._-]", "-", (tool or "unknown").strip().lower()) or "unknown"
    progress_path = cwd / PROGRESS_FILENAME
    state_path = cwd / ".codex" / f".progress_state.{safe_tool}.json"
    return progress_path, state_path


def ensure_progress(progress_path: Path) -> None:
    progress_path.parent.mkdir(parents=True, exist_ok=True)
    if not progress_path.exists():
        progress_path.write_text(PROGRESS_TEMPLATE, encoding="utf-8")
        return

    text = progress_path.read_text(encoding="utf-8", errors="replace")
    changed = False
    if not text.strip():
        progress_path.write_text(PROGRESS_TEMPLATE, encoding="utf-8")
        return
    if not re.search(r"(?m)^#\s+.*Progress Log", text):
        text = "# Project Progress Log\n\n" + text.rstrip() + "\n"
        changed = True
    if "## Current State" not in text:
        current = "\n## Current State\n" + "\n".join(f"- {field}:" for field in CURRENT_FIELDS) + "\n"
        text = text.rstrip() + current
        changed = True
    if "## Task Log" not in text:
        text = text.rstrip() + "\n\n## Task Log\n"
        changed = True

    if changed:
        progress_path.write_text(text.rstrip() + "\n", encoding="utf-8")


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def truncate(value: Any, limit: int = 300) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def contains_korean(text: str) -> bool:
    return bool(re.search(r"[가-힣ᄀ-ᇿ㄰-㆏]", text))


def current_state_block(text: str) -> str:
    match = re.search(r"(?ms)^## Current State\s*\n(.*?)(?=^## |\Z)", text)
    if not match:
        return ""
    return match.group(1).strip()


def task_log_entries(text: str) -> list[str]:
    """Return the real logged entries under ## Task Log, excluding the template stub."""
    match = re.search(r"(?ms)^## Task Log\s*\n(.*)\Z", text)
    if not match:
        return []
    entries = re.findall(r"(?ms)^### .+?(?=^### |\Z)", match.group(1))
    real: list[str] = []
    for entry in entries:
        header = entry.splitlines()[0].strip() if entry.strip() else ""
        if header and header != TEMPLATE_ENTRY_HEADER:
            real.append(entry.strip())
    return real


def task_entry_headers(text: str) -> list[str]:
    """Header lines of the real Task Log entries — used as an overwrite fingerprint."""
    return [entry.splitlines()[0].strip() for entry in task_log_entries(text)]


def recent_task_log(text: str, max_entries: int = 3) -> str:
    match = re.search(r"(?ms)^## Task Log\s*\n(.*)\Z", text)
    if not match:
        return ""
    body = match.group(1).strip()
    entries = re.findall(r"(?ms)^### .+?(?=^### |\Z)", body)
    if entries:
        return "\n\n".join(entry.strip() for entry in entries[-max_entries:])
    lines = [line for line in body.splitlines() if line.strip()]
    return "\n".join(lines[:12]).strip()


def update_current_state(progress_path: Path, updates: dict[str, str]) -> None:
    text = read_text(progress_path)
    if "## Current State" not in text:
        text = text.rstrip() + "\n\n## Current State\n" + "\n".join(f"- {f}:" for f in CURRENT_FIELDS) + "\n"

    lines = text.splitlines()
    start = next((i for i, line in enumerate(lines) if line.strip() == "## Current State"), None)
    if start is None:
        return
    end = len(lines)
    for i in range(start + 1, len(lines)):
        if lines[i].startswith("## "):
            end = i
            break

    section = lines[start + 1 : end]
    seen: set[str] = set()
    updated_section: list[str] = []
    for line in section:
        replaced = False
        for field, value in updates.items():
            if line.startswith(f"- {field}:"):
                updated_section.append(f"- {field}: {value}".rstrip())
                seen.add(field)
                replaced = True
                break
        if not replaced:
            updated_section.append(line)

    for field in CURRENT_FIELDS:
        if field not in seen and field in updates:
            updated_section.append(f"- {field}: {updates[field]}".rstrip())

    new_lines = lines[: start + 1] + updated_section + lines[end:]
    progress_path.write_text("\n".join(new_lines).rstrip() + "\n", encoding="utf-8")


def emit_context(message: str, event: str) -> None:
    """Print additional-context JSON understood by both Codex and Claude Code."""
    out: dict[str, Any] = {"additional_context": message, "additionalContext": message}
    claude_event = {
        "session_start": "SessionStart",
        "user_prompt_submit": "UserPromptSubmit",
    }.get(event)
    if claude_event:
        out["hookSpecificOutput"] = {"hookEventName": claude_event, "additionalContext": message}
    print(json.dumps(out, ensure_ascii=False))


def session_start(payload: dict[str, Any], tool: str) -> int:
    cwd = resolve_cwd(payload)
    progress_path, _ = paths(cwd, tool)
    ensure_progress(progress_path)
    text = read_text(progress_path)
    current = current_state_block(text) or "(Current State is empty.)"
    recent = recent_task_log(text) or "(No completed task entries yet.)"
    emit_context(
        f"공유 진행 로그(progress.md) 컨텍스트입니다. 현재 작업 도구: {tool_label(tool)}.\n\n"
        "Current State:\n"
        f"{current}\n\n"
        "Recent Task Log:\n"
        f"{recent}",
        "session_start",
    )
    return 0


def user_prompt_submit(payload: dict[str, Any], tool: str) -> int:
    cwd = resolve_cwd(payload)
    progress_path, state_path = paths(cwd, tool)
    ensure_progress(progress_path)

    prompt_excerpt = truncate(payload.get("prompt"), 300)
    active = prompt_excerpt or "(No prompt text provided.)"
    update_current_state(
        progress_path,
        {
            "Active task": active,
            "Active LLM": tool_label(tool),
            "Next recommended step": "현재 작업을 완료한 뒤 중지 전에 progress.md의 Task Log를 한국말로 간결하게 추가한다.",
        },
    )

    try:
        mtime_ns = progress_path.stat().st_mtime_ns
        size_bytes = progress_path.stat().st_size
    except OSError:
        mtime_ns = 0
        size_bytes = 0
    progress_text = read_text(progress_path)
    state = {
        "tool": tool,
        "session_id": payload.get("session_id"),
        "turn_id": payload.get("turn_id"),
        "prompt_excerpt": active,
        "started_at": time.time(),
        "progress_mtime_ns_after_prompt": mtime_ns,
        "progress_size_after_prompt": size_bytes,
        "progress_char_len_after_prompt": len(progress_text),
        "task_entry_headers_after_prompt": task_entry_headers(progress_text),
    }
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

    emit_context(
        f"이번 작업은 {tool_label(tool)}(으)로 수행됩니다. 시작 전 반드시 progress.md의 Current State, "
        "미해결 이슈, 최근 변경, 다음 단계를 고려하라. 작업 종료 전에는 변경 파일, 실행한 검증, 결과, "
        f"남은 이슈, 다음 단계와 함께 LLM 필드에 '{tool_label(tool)}'를 기록한 Task Log 항목을 한국말로 간결하게 추가하라. "
        "progress.md는 절대 새로 덮어쓰지 말고 기존 항목을 그대로 보존한 채 파일 끝(Task Log 마지막)에 새 항목만 이어서 추가하라.",
        "user_prompt_submit",
    )
    return 0


def truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def stop(payload: dict[str, Any], tool: str) -> int:
    cwd = resolve_cwd(payload)
    progress_path, state_path = paths(cwd, tool)
    ensure_progress(progress_path)

    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
        if not isinstance(state, dict):
            state = {}
    except Exception:
        state = {}

    try:
        current_mtime_ns = progress_path.stat().st_mtime_ns
    except OSError:
        current_mtime_ns = 0
    baseline_ns = int(state.get("progress_mtime_ns_after_prompt") or 0)
    updated_after_prompt = current_mtime_ns > baseline_ns if baseline_ns else True
    text = read_text(progress_path)
    baseline_len = int(state.get("progress_char_len_after_prompt") or 0)
    changed_text = text[baseline_len:] if baseline_len and len(text) >= baseline_len else text
    korean_update = contains_korean(changed_text)
    baseline_headers = state.get("task_entry_headers_after_prompt")
    if not isinstance(baseline_headers, list):
        baseline_headers = []
    current_headers = task_entry_headers(text)
    missing_headers = [h for h in baseline_headers if h not in current_headers]
    lost_history = bool(missing_headers)

    if truthy(payload.get("stop_hook_active")):
        return 0

    if lost_history:
        # A prior entry disappeared: the file was rewritten from scratch or entries were
        # deleted. Refuse to let the turn end until the history is restored.
        sample = "; ".join(missing_headers[:3])
        reason = (
            f"progress.md의 기존 Task Log 항목이 사라졌습니다(덮어쓰기 감지). 사라진 항목: {sample}. "
            "파일을 새로 작성하지 말고, 이전 항목을 모두 그대로 복원한 뒤 새 항목만 파일 끝에 이어서 추가하세요."
        )
        print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    elif not updated_after_prompt:
        reason = (
            f"progress.md가 이번 턴 시작 이후 업데이트되지 않았습니다. 중지하기 전에 Task, LLM(={tool_label(tool)}), "
            "Summary, Files changed, Checks run, Result, Open issues, Next를 포함한 Task Log 항목을 "
            "기존 내용을 지우지 말고 파일 끝에 한국말로 간결하게 추가하세요."
        )
        print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    elif not korean_update:
        reason = (
            "progress.md는 업데이트되었지만 이번 턴에서 추가된 내용에 한국말이 확인되지 않았습니다. "
            f"작업 종료 전 LLM 필드에 '{tool_label(tool)}'를 포함해 Task Log를 한국말로 작성하세요."
        )
        print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("event", nargs="?")
    parser.add_argument("--tool", default=None, help="codex | claude-code")
    args = parser.parse_args()
    payload = read_payload()
    event = (args.event or payload.get("hook_event_name") or "").strip().lower()
    event = event.replace("-", "_")
    tool = (args.tool or payload.get("tool") or "unknown").strip().lower()

    try:
        if event in {"session_start", "sessionstart"}:
            return session_start(payload, tool)
        if event in {"user_prompt_submit", "userpromptsubmit"}:
            return user_prompt_submit(payload, tool)
        if event == "stop":
            return stop(payload, tool)
    except Exception as exc:  # noqa: BLE001 - hooks must not break normal work
        print(f"progress_hook: non-fatal error: {exc}", file=sys.stderr)
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
