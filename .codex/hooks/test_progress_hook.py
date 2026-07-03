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


def run_hook(cwd: Path, event: str, payload: dict, tool: str = "claude-code") -> subprocess.CompletedProcess[str]:
    data = dict(payload)
    data.setdefault("cwd", str(cwd))
    data.setdefault("hook_event_name", event)
    return subprocess.run(
        [sys.executable, str(HOOK), event, "--tool", tool],
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
    with tempfile.TemporaryDirectory(prefix="progress-hook-") as tmp:
        cwd = Path(tmp)
        # Anchor: create the hook-script marker so resolve_cwd pins this temp dir as the root
        # (and never walks up into a parent that happens to contain project markers).
        (cwd / ".codex" / "hooks").mkdir(parents=True, exist_ok=True)
        (cwd / ".codex" / "hooks" / "progress_hook.py").write_text("# marker\n", encoding="utf-8")
        progress = cwd / "progress.md"                       # shared, at project root
        state = cwd / ".codex" / ".progress_state.claude-code.json"  # per-tool baseline

        result = run_hook(cwd, "session_start", {"session_id": "s1", "turn_id": "t0"})
        assert_true(result.returncode == 0, result.stderr)
        assert_true(progress.exists(), "SessionStart should create progress.md at project root")
        ctx = parse_json_stdout(result)
        assert_true("additional_context" in ctx, "SessionStart should return Codex context key")
        assert_true("hookSpecificOutput" in ctx, "SessionStart should return Claude Code context key")

        result = run_hook(
            cwd,
            "user_prompt_submit",
            {"session_id": "s1", "turn_id": "t1", "prompt": "Implement progress tracking."},
        )
        assert_true(result.returncode == 0, result.stderr)
        assert_true(state.exists(), "UserPromptSubmit should create per-tool state file")
        progress_text = progress.read_text(encoding="utf-8")
        assert_true("Implement progress tracking" in progress_text, "progress should record active task")
        assert_true("Active LLM: Claude Code" in progress_text, "progress should record the active LLM/tool")
        assert_true("additional_context" in parse_json_stdout(result), "UserPromptSubmit should return context")

        result = run_hook(cwd, "stop", {"session_id": "s1", "turn_id": "t1", "stop_hook_active": False})
        assert_true(result.returncode == 0, result.stderr)
        blocked = parse_json_stdout(result)
        assert_true(blocked.get("decision") == "block", "Stop should block when progress was not updated")

        state_obj = json.loads(state.read_text(encoding="utf-8"))
        assert_true(state_obj.get("tool") == "claude-code", "state should record the tool")
        baseline = int(state_obj["progress_mtime_ns_after_prompt"])
        with progress.open("a", encoding="utf-8") as fh:
            fh.write("\n### 2099-01-01 00:00 KST\n- Task: Test\n- LLM: Claude Code\n- Summary: Test update.\n")
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

        # Overwrite guard: rewriting progress.md from the template (dropping the entry we
        # just logged) must be blocked, even though the new region contains Korean.
        run_hook(
            cwd,
            "user_prompt_submit",
            {"session_id": "s1", "turn_id": "t1b", "prompt": "후속 작업."},
        )
        baseline = int(json.loads(state.read_text(encoding="utf-8"))["progress_mtime_ns_after_prompt"])
        overwritten = progress.read_text(encoding="utf-8").split("## Task Log")[0] + (
            "## Task Log\n\n### 2099-02-02 00:00 KST\n- Task: 새 작업만 기록.\n- LLM: Claude Code\n"
        )
        progress.write_text(overwritten, encoding="utf-8")
        os.utime(progress, ns=(baseline + 6_000_000_000, baseline + 6_000_000_000))
        time.sleep(0.01)
        result = run_hook(cwd, "stop", {"session_id": "s1", "turn_id": "t1b", "stop_hook_active": False})
        blocked = parse_json_stdout(result)
        assert_true(blocked.get("decision") == "block", "Stop should block when prior entries are overwritten")
        assert_true("덮어쓰기" in blocked.get("reason", ""), "block reason should flag the overwrite")

        # Restoring the dropped entry and appending a new one should pass.
        with progress.open("a", encoding="utf-8") as fh:
            # restore the earlier real entry (2099-01-01) that the overwrite dropped
            fh.write("\n### 2099-01-01 00:00 KST\n- Task: Test\n- Result: 한국말 복원.\n")
        os.utime(progress, ns=(baseline + 8_000_000_000, baseline + 8_000_000_000))
        time.sleep(0.01)
        result = run_hook(cwd, "stop", {"session_id": "s1", "turn_id": "t1b", "stop_hook_active": False})
        assert_true(result.stdout.strip() == "", "Stop should pass once history is preserved and appended")

        # A second tool shares the same progress.md but keeps its own baseline state.
        result = run_hook(
            cwd,
            "user_prompt_submit",
            {"session_id": "s2", "turn_id": "t2", "prompt": "Codex 후속 작업."},
            tool="codex",
        )
        assert_true(result.returncode == 0, result.stderr)
        assert_true((cwd / ".codex" / ".progress_state.codex.json").exists(), "codex should get its own state file")
        assert_true("Active LLM: Codex CLI" in progress.read_text(encoding="utf-8"), "codex run should update Active LLM")

    print("progress_hook tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
