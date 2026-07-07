#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""LaunchPass 규제 검증 엔진.

카피 텍스트를 국가별 룰셋(rules/{국가코드}.json)의 ng_patterns와 대조하여
규제 위반을 코드로 탐지한다. AI 판단이 아니라 룰셋 + 코드가 판정한다는 점이
신뢰성의 근거다.

설계 원칙:
- 특정 언어에 종속되지 않는다. 매칭은 룰셋의 ng_patterns(문자열/정규식)에만 의존한다.
- 룰셋은 디스크에서 직접 읽으며, 룰 본문은 호출자(LLM) 컨텍스트에 올리지 않는다.

사용법:
    python validate_copy.py --input "카피 텍스트" --rules rules/jp.json
    python validate_copy.py --input-file copy.txt --rules rules/jp.json

이 파일(2-1)은 코어 탐지(룰셋 로드·문장 분리·패턴 매칭)를 담당한다.
개념 매핑(2-2), 출력 JSON 포맷 확정(2-3), 신선도 체크(2-4)는 후속 작업에서 확장한다.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from typing import Any

# 개념 매핑 테이블 기본 경로 (스크립트와 동봉)
_DEFAULT_CONCEPT_MAP = os.path.join(os.path.dirname(__file__), "ko_concept_map.json")


# --- 데이터 구조 -----------------------------------------------------------

@dataclass
class Match:
    """카피에서 탐지된 개별 위반 매칭."""
    rule_id: str
    category: str
    matched: str          # 실제로 카피에서 매칭된 문자열
    pattern: str          # 매칭을 유발한 룰셋 패턴
    position: int         # 카피 텍스트 내 문자 인덱스(0-based)
    severity: str         # "VIOLATION" | "WARNING"
    reason: str
    alternatives: list[str] = field(default_factory=list)
    source: str = "pattern"   # "pattern"(직접) | "concept"(개념 매핑, 2-2에서 사용)


# --- 룰셋 로드 -------------------------------------------------------------

def load_ruleset(path: str) -> dict[str, Any]:
    """룰셋 JSON을 로드한다. 룰 본문은 이 스크립트 내부에서만 소비된다."""
    with open(path, encoding="utf-8") as fh:
        ruleset = json.load(fh)
    if "rules" not in ruleset or not isinstance(ruleset["rules"], list):
        raise ValueError(f"유효하지 않은 룰셋: 'rules' 배열 없음 ({path})")
    return ruleset


# --- 문장 분리 -------------------------------------------------------------

# 한국어/일본어/영어 공통 문장 종결부호로 분리. 형태소 분석기 비의존(언어 무종속).
_SENTENCE_SPLIT = re.compile(r"[.!?。！？\n]+")


def split_sentences(text: str) -> list[str]:
    """카피를 문장 단위로 분리한다. pass_rate 계산(2-3)의 분모가 된다."""
    parts = [s.strip() for s in _SENTENCE_SPLIT.split(text)]
    return [s for s in parts if s]


# --- 패턴 매칭 -------------------------------------------------------------

def _iter_pattern_hits(text: str, pattern: str) -> list[tuple[str, int]]:
    """text에서 pattern의 모든 출현을 (matched_text, position)으로 반환한다.

    pattern은 우선 정규식으로 시도하고, 정규식이 아니거나 컴파일 실패 시
    대소문자 무시 부분문자열 매칭으로 폴백한다(언어 무종속).
    """
    hits: list[tuple[str, int]] = []
    try:
        compiled = re.compile(pattern, re.IGNORECASE)
        # 정규식 특수문자가 없으면 사실상 리터럴로 동작하므로 그대로 사용
        for m in compiled.finditer(text):
            if m.group(0):
                hits.append((m.group(0), m.start()))
    except re.error:
        # 잘못된 정규식은 리터럴 부분문자열로 처리
        low_text, low_pat = text.lower(), pattern.lower()
        start = 0
        while True:
            idx = low_text.find(low_pat, start)
            if idx == -1:
                break
            hits.append((text[idx: idx + len(pattern)], idx))
            start = idx + max(1, len(pattern))
    return hits


def find_violations(text: str, ruleset: dict[str, Any]) -> list[Match]:
    """카피 텍스트를 룰셋의 모든 ng_patterns와 대조하여 매칭을 수집한다."""
    matches: list[Match] = []
    for rule in ruleset["rules"]:
        for pattern in rule.get("ng_patterns", []):
            for matched_text, pos in _iter_pattern_hits(text, pattern):
                matches.append(Match(
                    rule_id=rule["id"],
                    category=rule.get("category", ""),
                    matched=matched_text,
                    pattern=pattern,
                    position=pos,
                    severity=rule.get("severity", "WARNING"),
                    reason=rule.get("reason", ""),
                    alternatives=list(rule.get("alternatives", [])),
                    source="pattern",
                ))
    # 등장 위치 순 정렬 → 보고서 하이라이트 순서와 일치
    matches.sort(key=lambda m: m.position)
    return matches


# --- 한국어 개념 매핑 탐지 (2-2) -------------------------------------------

def load_concept_map(path: str | None) -> dict[str, list[str]]:
    """한국어 개념 매핑 테이블을 로드한다. 없으면 빈 매핑을 반환(개념 패스 생략)."""
    target = path or _DEFAULT_CONCEPT_MAP
    if not os.path.exists(target):
        return {}
    with open(target, encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("concepts", {})


def find_concept_matches(
    text: str,
    ruleset: dict[str, Any],
    concept_map: dict[str, list[str]],
) -> list[Match]:
    """한국어 카피의 NG 개념을 사전 탐지한다.

    한국어 카피는 타겟 국가의 현지어 룰(ng_patterns)과 문자열이 달라 직접
    매칭되지 않을 수 있다. 개념 매핑 테이블로 한국어 표현 → 개념 키워드로
    확장한 뒤, 룰의 ng_patterns가 그 키워드를 포함하면 '위반 예정'으로 경고한다.
    (예: 카피 "피부 재생" → 개념 '재생' → 키워드 '再生' 포함하는 JP-001 경고)
    """
    matches: list[Match] = []
    for ko_term, keywords in concept_map.items():
        keyset = {k.lower() for k in keywords}
        for matched_text, pos in _iter_pattern_hits(text, ko_term):
            for rule in ruleset["rules"]:
                patterns = [p.lower() for p in rule.get("ng_patterns", [])]
                # 룰의 ng_patterns가 이 개념의 키워드와 겹치면 연관 룰로 간주
                if keyset.intersection(patterns):
                    matches.append(Match(
                        rule_id=rule["id"],
                        category=rule.get("category", ""),
                        matched=matched_text,
                        pattern=f"concept:{ko_term}",
                        position=pos,
                        severity=rule.get("severity", "WARNING"),
                        reason=(rule.get("reason", "")
                                + " [개념 매핑: 한국어 표현이 현지 규제 개념에 해당(위반 예정)]").strip(),
                        alternatives=list(rule.get("alternatives", [])),
                        source="concept",
                    ))
    return matches


def _dedupe(matches: list[Match]) -> list[Match]:
    """(rule_id, position, matched) 기준 중복 제거. 직접 패턴 매칭을 우선 보존한다."""
    best: dict[tuple[str, int, str], Match] = {}
    for m in matches:
        key = (m.rule_id, m.position, m.matched)
        prev = best.get(key)
        if prev is None or (prev.source == "concept" and m.source == "pattern"):
            best[key] = m
    return sorted(best.values(), key=lambda m: m.position)


def detect(
    text: str,
    ruleset: dict[str, Any],
    concept_map: dict[str, list[str]] | None = None,
) -> list[Match]:
    """직접 패턴 매칭 + 한국어 개념 매핑을 합쳐 중복 제거한 위반 목록을 반환한다."""
    matches = find_violations(text, ruleset)
    if concept_map:
        matches += find_concept_matches(text, ruleset, concept_map)
    return _dedupe(matches)


# --- CLI -------------------------------------------------------------------

def _read_input(args: argparse.Namespace) -> str:
    if args.input is not None:
        return args.input
    if args.input_file is not None:
        with open(args.input_file, encoding="utf-8") as fh:
            return fh.read()
    raise SystemExit("오류: --input 또는 --input-file 중 하나는 필요합니다.")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="LaunchPass 규제 검증 엔진 — 카피를 룰셋과 대조해 위반을 탐지한다.",
    )
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--input", help="검증할 카피 텍스트")
    src.add_argument("--input-file", help="카피 텍스트 파일 경로")
    p.add_argument("--rules", required=True, help="룰셋 JSON 경로 (rules/{국가코드}.json)")
    p.add_argument("--concept-map", default=None,
                   help="한국어 개념 매핑 JSON 경로 (기본: 스크립트 동봉 ko_concept_map.json)")
    p.add_argument("--no-concept", action="store_true",
                   help="한국어 개념 매핑 탐지를 비활성화한다")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    text = _read_input(args)
    ruleset = load_ruleset(args.rules)
    concept_map = {} if args.no_concept else load_concept_map(args.concept_map)
    matches = detect(text, ruleset, concept_map)

    # 2-3에서 verdict/pass_rate를 포함한 최종 JSON 포맷으로 확정한다.
    # 현재(2-1)는 코어 매칭 결과를 확인 가능한 형태로 출력한다.
    payload = {
        "market": ruleset.get("market"),
        "matches": [vars(m) for m in matches],
        "sentence_count": len(split_sentences(text)),
    }
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
