"""제출 패키지 빌더 — submission.zip 생성 (기획서 §3 구조).

포함: src/ (플러그인 본체), logs/ (AI 대화 로그 무편집), README.md
제외: strategies/, progress.md, CLAUDE.md, AGENTS.md, .codex/, tools/, .agents/, __pycache__

제출 직전 재실행하면 최신 대화 로그까지 반영된다.
사용: python build_submission.py
"""
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "submission.zip")

INCLUDE_DIRS = ["src", "logs"]
INCLUDE_FILES = ["README.md"]
SKIP_DIR_NAMES = {"__pycache__"}


def add_dir(zf, base):
    for dp, dns, fns in os.walk(base):
        dns[:] = [d for d in dns if d not in SKIP_DIR_NAMES]
        for fn in fns:
            if fn.endswith(".pyc"):
                continue
            full = os.path.join(dp, fn)
            rel = os.path.relpath(full, ROOT).replace("\\", "/")
            zf.write(full, rel)


def build():
    if os.path.exists(OUT):
        os.remove(OUT)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for d in INCLUDE_DIRS:
            add_dir(zf, os.path.join(ROOT, d))
        for f in INCLUDE_FILES:
            zf.write(os.path.join(ROOT, f), f)
    with zipfile.ZipFile(OUT) as zf:
        names = zf.namelist()
    return names


if __name__ == "__main__":
    names = build()
    # ponytail: 최소 자가 점검 — 필수 산출물이 누락되면 즉시 실패
    required = ["README.md", "src/scripts/validate_copy.py",
                "src/skills/launchpass/SKILL.md"]
    for r in required:
        assert r in names, f"누락: {r}"
    assert any(n.startswith("logs/") for n in names), "로그 누락"
    print(f"submission.zip OK — {len(names)} files, {os.path.getsize(OUT)} bytes")
