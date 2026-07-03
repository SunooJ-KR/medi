#!/usr/bin/env python3
"""Local tests for progress_hook.py using only the standard library."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path


HOOK = Path(__file__).with_name("progress_hook.py")


def run_hook(cwd: Path, event: str, payload: dict) -> subprocess.CompletedProcess[str]:
    data = dict(payload)
    data.setdefault("cwd", str(cwd))
    data.setdefault("hook_event_name", event)
    return subprocess.run(
        [sys.executable, str(HOOK), event],
        input=json.dumps(data),
        text=True,
        capture_output=True,
        check=False,
    )


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def parse_json_stdout(result: subprocess.CompletedProcess[str]) -> dict:
    assert_true(result.stdout.strip() != "", "expected JSON stdout")
    value = json.loads(result.stdout)
    assert_true(isinstance(value, dict), "stdout must be a JSON object")
    return value


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="codex-progress-hook-") as tmp:
        cwd = Path(tmp)
        progress = cwd / ".codex" / "progress.md"
        state = cwd / ".codex" / ".progress_state.json"

        result = run_hook(cwd, "session_start", {"session_id": "s1", "turn_id": "t0"})
        assert_true(result.returncode == 0, result.stderr)
        assert_true(progress.exists(), "SessionStart should create progress.md")
        assert_true("additional_context" in parse_json_stdout(result), "SessionStart should return context")

        result = run_hook(
            cwd,
            "user_prompt_submit",
            {"session_id": "s1", "turn_id": "t1", "prompt": "Implement progress tracking."},
        )
        assert_true(result.returncode == 0, result.stderr)
        assert_true(state.exists(), "UserPromptSubmit should create state file")
        assert_true("Implement progress tracking" in progress.read_text(encoding="utf-8"), "progress should record active task")
        assert_true("additional_context" in parse_json_stdout(result), "UserPromptSubmit should return context")

        result = run_hook(cwd, "stop", {"session_id": "s1", "turn_id": "t1", "stop_hook_active": False})
        assert_true(result.returncode == 0, result.stderr)
        blocked = parse_json_stdout(result)
        assert_true(blocked.get("decision") == "block", "Stop should block when progress was not updated")

        state_obj = json.loads(state.read_text(encoding="utf-8"))
        baseline = int(state_obj["progress_mtime_ns_after_prompt"])
        with progress.open("a", encoding="utf-8") as fh:
            fh.write("\n### 2099-01-01 00:00 KST\n- Task: Test\n- Summary: Test update.\n")
        os.utime(progress, ns=(baseline + 2_000_000_000, baseline + 2_000_000_000))
        time.sleep(0.01)
        result = run_hook(cwd, "stop", {"session_id": "s1", "turn_id": "t1", "stop_hook_active": False})
        assert_true(result.returncode == 0, result.stderr)
        blocked = parse_json_stdout(result)
        assert_true(blocked.get("decision") == "block", "Stop should block when update is not Korean")

        with progress.open("a", encoding="utf-8") as fh:
            fh.write("- Result: 한국말 업데이트 확인.\n")
        os.utime(progress, ns=(baseline + 4_000_000_000, baseline + 4_000_000_000))
        time.sleep(0.01)
        result = run_hook(cwd, "stop", {"session_id": "s1", "turn_id": "t1", "stop_hook_active": False})
        assert_true(result.returncode == 0, result.stderr)
        assert_true(result.stdout.strip() == "", "Stop should not block after Korean progress update")

    print("progress_hook tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
