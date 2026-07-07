# -*- coding: utf-8 -*-
"""validate_copy.py 단위 테스트.

표준 라이브러리(unittest)만 사용한다. 테스트 룰셋 픽스처는 실제 국가가 아닌
가상 코드 ZZ(rules_zz.json)를 쓴다 — 저장소에 특정 국가 데이터를 사전 내장하지
않는다는 원칙을 테스트에서도 지킨다.

실행:
    python -m unittest discover -s src/tests
"""

import json
import os
import sys
import unittest
from datetime import date

# scripts 디렉토리를 import 경로에 추가
_HERE = os.path.dirname(__file__)
_SCRIPTS = os.path.abspath(os.path.join(_HERE, "..", "scripts"))
sys.path.insert(0, _SCRIPTS)

import validate_copy as vc  # noqa: E402

FIXTURE = os.path.join(_HERE, "fixtures", "rules_zz.json")


def load_fixture():
    with open(FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


class TestPatternMatching(unittest.TestCase):
    def setUp(self):
        self.ruleset = load_fixture()

    def test_literal_pattern_detected(self):
        """현지어/한국어 리터럴 ng_pattern이 탐지된다."""
        matches = vc.find_violations("이 제품은 피부 재생 세럼입니다.", self.ruleset)
        ids = {m.rule_id for m in matches}
        self.assertIn("ZZ-001", ids)

    def test_regex_pattern_detected(self):
        """정규식 ng_pattern(No\\.?1)이 'No1'과 'No.1' 모두 탐지된다."""
        m1 = vc.find_violations("No1 세럼", self.ruleset)
        m2 = vc.find_violations("No.1 세럼", self.ruleset)
        self.assertTrue(any(m.rule_id == "ZZ-003" for m in m1))
        self.assertTrue(any(m.rule_id == "ZZ-003" for m in m2))

    def test_clean_copy_no_match(self):
        """위반 없는 카피는 매칭 0건."""
        matches = vc.find_violations("수분을 공급하여 촉촉하게 정돈합니다.", self.ruleset)
        self.assertEqual(matches, [])

    def test_position_recorded(self):
        """매칭 위치가 정확히 기록된다."""
        text = "촉촉한 재생 크림"
        matches = vc.find_violations(text, self.ruleset)
        self.assertEqual(matches[0].matched, "재생")
        self.assertEqual(text[matches[0].position:matches[0].position + 2], "재생")


class TestConceptMapping(unittest.TestCase):
    def setUp(self):
        self.ruleset = load_fixture()
        self.cmap = vc.load_concept_map(None)

    def test_korean_concept_hits_localized_rule(self):
        """한국어 '미백'이 현지어(美白)만 있는 ZZ-002를 개념 매핑으로 탐지한다."""
        # 직접 매칭으로는 안 걸림
        direct = vc.find_violations("미백 효과가 좋은 세럼", self.ruleset)
        self.assertFalse(any(m.rule_id == "ZZ-002" for m in direct))
        # 개념 매핑으로는 걸림
        concept = vc.find_concept_matches("미백 효과가 좋은 세럼", self.ruleset, self.cmap)
        self.assertTrue(any(m.rule_id == "ZZ-002" and m.source == "concept" for m in concept))

    def test_dedupe_prefers_direct_pattern(self):
        """같은 위치·룰에 직접·개념 매칭이 겹치면 직접(pattern)을 보존한다."""
        # '재생'은 ZZ-001의 리터럴이자 개념 '재생'의 키. dedupe 후 pattern 우선
        matches = vc.detect("피부 재생 크림", self.ruleset, self.cmap)
        zz001 = [m for m in matches if m.rule_id == "ZZ-001"]
        self.assertTrue(zz001)
        self.assertTrue(any(m.source == "pattern" for m in zz001))


class TestVerdictAndPassRate(unittest.TestCase):
    def setUp(self):
        self.ruleset = load_fixture()
        self.cmap = vc.load_concept_map(None)

    def test_verdict_violation(self):
        matches = vc.detect("피부 재생 세럼", self.ruleset, self.cmap)
        self.assertEqual(vc.compute_verdict(matches), "VIOLATION")

    def test_verdict_warning_only(self):
        matches = vc.detect("최고의 사용감", self.ruleset, self.cmap)
        self.assertEqual(vc.compute_verdict(matches), "WARNING")

    def test_verdict_pass(self):
        matches = vc.detect("수분을 공급하여 정돈합니다.", self.ruleset, self.cmap)
        self.assertEqual(vc.compute_verdict(matches), "PASS")

    def test_pass_rate_counts_sentences(self):
        """3문장 중 2문장 위반 → 1/3 통과."""
        text = "피부 재생 세럼입니다. 미백에도 좋아요. 촉촉하게 정돈합니다."
        matches = vc.detect(text, self.ruleset, self.cmap)
        pr = vc.compute_pass_rate(text, matches)
        self.assertEqual((pr["passed"], pr["total"]), (1, 3))
        self.assertEqual(pr["label"], "1/3 문장 통과")


class TestFreshness(unittest.TestCase):
    def setUp(self):
        self.ruleset = load_fixture()  # last_verified = 2026-01-01

    def test_fresh_within_threshold(self):
        f = vc.check_freshness(self.ruleset, today=date(2026, 2, 1))
        self.assertFalse(f["stale"])
        self.assertIsNone(f["warning"])

    def test_stale_beyond_threshold(self):
        f = vc.check_freshness(self.ruleset, today=date(2026, 6, 1))
        self.assertTrue(f["stale"])
        self.assertIsNotNone(f["warning"])

    def test_missing_last_verified_is_stale(self):
        rs = dict(self.ruleset)
        rs.pop("last_verified", None)
        f = vc.check_freshness(rs, today=date(2026, 2, 1))
        self.assertTrue(f["stale"])


class TestBuildResultContract(unittest.TestCase):
    def setUp(self):
        self.ruleset = load_fixture()
        self.cmap = vc.load_concept_map(None)

    def test_result_has_required_keys(self):
        matches = vc.detect("피부 재생 세럼", self.ruleset, self.cmap)
        result = vc.build_result("피부 재생 세럼", self.ruleset, matches, today=date(2026, 2, 1))
        for key in ("verdict", "violations", "pass_rate", "freshness",
                    "violation_count", "warning_count", "market"):
            self.assertIn(key, result)
        v = result["violations"][0]
        for key in ("rule_id", "matched", "position", "severity", "alternatives"):
            self.assertIn(key, v)


if __name__ == "__main__":
    unittest.main(verbosity=2)
