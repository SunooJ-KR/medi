#!/usr/bin/env python3
"""Project-local Codex progress tracking hook.

Handles SessionStart, UserPromptSubmit, and Stop-style events without relying on
transcript files. The hook reads JSON from stdin and never raises user-visible
tracebacks for missing fields.
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
CURRENT_FIELDS = (
    "Active task",
    "Current branch",
    "Last known working state",
    "Pending issues",
    "Next recommended step",
)
PROGRESS_TEMPLATE = """# Codex Progress Log

## Current State
- Active task:
- Current branch:
- Last known working state:
- Pending issues:
- Next recommended step:

## Task Log

Each completed task should append an entry in this format.

### YYYY-MM-DD HH:mm KST
- Task:
- Summary:
- Files changed:
- Checks run:
- Result:
- Open issues:
- Next:
"""


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
        return Path(cwd).expanduser().resolve()
    return Path.cwd().resolve()


def paths(cwd: Path) -> tuple[Path, Path, Path]:
    codex_dir = cwd / ".codex"
    return codex_dir, codex_dir / "progress.md", codex_dir / ".progress_state.json"


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
    if "# Codex Progress Log" not in text:
        text = "# Codex Progress Log\n\n" + text.rstrip() + "\n"
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
    return bool(re.search(r"[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]", text))


def current_state_block(text: str) -> str:
    match = re.search(r"(?ms)^## Current State\s*\n(.*?)(?=^## |\Z)", text)
    if not match:
        return ""
    return match.group(1).strip()


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


def emit_context(message: str) -> None:
    print(json.dumps({"additional_context": message, "additionalContext": message}, ensure_ascii=False))


def session_start(payload: dict[str, Any]) -> int:
    cwd = resolve_cwd(payload)
    _, progress_path, _ = paths(cwd)
    ensure_progress(progress_path)
    text = read_text(progress_path)
    current = current_state_block(text) or "(Current State is empty.)"
    recent = recent_task_log(text) or "(No completed task entries yet.)"
    emit_context(
        "Project progress context from .codex/progress.md:\n\n"
        "Current State:\n"
        f"{current}\n\n"
        "Recent Task Log:\n"
        f"{recent}"
    )
    return 0


def user_prompt_submit(payload: dict[str, Any]) -> int:
    cwd = resolve_cwd(payload)
    _, progress_path, state_path = paths(cwd)
    ensure_progress(progress_path)

    prompt_excerpt = truncate(payload.get("prompt"), 300)
    active = prompt_excerpt or "(No prompt text provided.)"
    update_current_state(
        progress_path,
        {
            "Active task": active,
            "Next recommended step": "현재 작업을 완료한 뒤 중지 전에 .codex/progress.md의 Task Log를 한국말로 간결하게 추가한다.",
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
        "session_id": payload.get("session_id"),
        "turn_id": payload.get("turn_id"),
        "prompt_excerpt": active,
        "started_at": time.time(),
        "progress_mtime_ns_after_prompt": mtime_ns,
        "progress_size_after_prompt": size_bytes,
        "progress_char_len_after_prompt": len(progress_text),
    }
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

    emit_context(
        "이번 작업 전 반드시 .codex/progress.md의 Current State, 미해결 이슈, 최근 변경, "
        "다음 단계를 고려하라. 작업 종료 전에는 변경 파일, 실행한 검증, 결과, 남은 이슈, "
        "다음 단계를 포함한 Task Log 항목을 한국말로 간결하게 추가하라."
    )
    return 0


def truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def stop(payload: dict[str, Any]) -> int:
    cwd = resolve_cwd(payload)
    _, progress_path, state_path = paths(cwd)
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

    if not updated_after_prompt and not truthy(payload.get("stop_hook_active")):
        reason = (
            ".codex/progress.md가 이번 턴 시작 이후 업데이트되지 않았습니다. "
            "중지하기 전에 Task, Summary, Files changed, Checks run, Result, "
            "Open issues, Next를 포함한 Task Log 항목을 한국말로 간결하게 추가하세요."
        )
        print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    elif not korean_update and not truthy(payload.get("stop_hook_active")):
        reason = (
            ".codex/progress.md는 업데이트되었지만 이번 턴에서 추가된 내용에 한국말이 확인되지 않았습니다. "
            "작업 종료 전 Task Log를 한국말로 작성하세요."
        )
        print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("event", nargs="?")
    args = parser.parse_args()
    payload = read_payload()
    event = (args.event or payload.get("hook_event_name") or "").strip().lower()
    event = event.replace("-", "_")

    try:
        if event in {"session_start", "sessionstart"}:
            return session_start(payload)
        if event in {"user_prompt_submit", "userpromptsubmit"}:
            return user_prompt_submit(payload)
        if event == "stop":
            return stop(payload)
    except Exception as exc:  # noqa: BLE001 - hooks must not break normal work
        print(f"progress_hook: non-fatal error: {exc}", file=sys.stderr)
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
