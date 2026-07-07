# LaunchPass 개발 계획서 (dev-plan.md)

> 기반 문서: `strategies/plan.md` (LaunchPass — K-뷰티 글로벌 런칭 레디니스 검증 Codex 플러그인 최종 기획서)
> 본 문서는 **개발 계획만** 서술한다. 작업 진행 상황·이력 관리는 `progress.md`에서 수행한다.

---

## 1. 개발 목표

제품명과 타겟 국가를 입력하면 ① 현지 시장 조사 → ② 표현 규제 검증 → ③ 현지 페르소나별 카피 생성 → ④ 런칭 레디니스 판정(HTML 보고서)까지 자동 수행하는 Codex 플러그인을 구현한다.

### 핵심 설계 원칙 (기획서 §0, §2 준수)

1. **국가 무종속**: 특정 국가 데이터를 저장소에 사전 내장하지 않는다. 저장소에는 `_schema.json` 3종만 존재하고, 국가별 데이터(`rules/`, `concerns/`, `personas/`의 `{국가코드}.json`)는 실행 시 부트스트랩으로 생성된다.
2. **판정은 코드, 생성은 AI**: 규제 위반 판정은 `validate_copy.py`(룰셋 기반 코드)가 수행하고, AI는 조사·카피 생성·대체안 제안만 담당한다.
3. **AI는 초안, 확정은 사람**: 부트스트랩으로 생성된 데이터는 `.draft.json`으로 만들고, 사람 승인 후에만 정식 파일로 승격한다 (`verified_by: "human"`).
4. **토큰 효율**: 룰셋 본문을 LLM 컨텍스트에 올리지 않는다. 검증은 스크립트에 위임하고 위반 결과만 사용한다.
5. **데이터 의존성 순서**: concerns → rules → personas 순으로 생성한다 (personas는 concerns 격자에서 파생).

---

## 2. 최종 산출물 구조

```
submission.zip
├── src/
│   ├── .codex-plugin/plugin.json          # 플러그인 메타데이터
│   ├── skills/launchpass/SKILL.md         # STAGE 0~4 실행 절차서
│   ├── .mcp.json                          # web_search MCP 설정
│   ├── rules/_schema.json                 # 규제 룰셋 스키마 (사전 존재 유일 파일)
│   ├── concerns/_schema.json              # 국가×나이대×피부고민 격자 스키마
│   ├── personas/_schema.json              # 페르소나 스키마
│   ├── scripts/validate_copy.py           # 규제 검증 엔진
│   ├── templates/readiness_report.html    # 보고서 템플릿
│   └── examples/
│       ├── sample_input_wrinklefit.md     # 예제 입력 (국가는 실행 시 지정)
│       └── sample_run_log.md              # 임의 국가 1회 실행 전체 로그
├── README.md
└── logs/                                  # AI 대화 로그 전체 (무편집)
```

---

## 3. 개발 단계 (Phase)

### Phase 1 — 스키마 + 프로젝트 골격 (기획서 Day 1)

**목표**: 국가 무관 데이터 계약(스키마) 확정과 플러그인 골격 셋업.

| # | 작업 | 산출물 | 완료 기준 |
|---|------|--------|-----------|
| 1-1 | 디렉토리 구조 및 `plugin.json` 셋업 | `src/.codex-plugin/plugin.json`, 디렉토리 골격 | 기획서 §4-1 메타데이터와 일치, 국가별 데이터 파일 없음 확인 |
| 1-2 | `concerns/_schema.json` 설계 | 스키마 파일 | `market`, `version`, `last_verified`, `age_bands`, `grid[]`(age_band, top_concerns, evidence 필수, kbeauty_affinity) 정의 |
| 1-3 | `rules/_schema.json` 설계 | 스키마 파일 | `market`, `version`, `last_verified`, `verified_by`, `legal_basis`, `source_urls`, `rules[]`(id, category, ng_patterns, severity{VIOLATION/WARNING}, reason, condition, alternatives) 정의 |
| 1-4 | `personas/_schema.json` 설계 | 스키마 파일 | `market`, `derived_from`, `personas[]`(id, age_band, linked_concerns, label, description, evidence, copy_direction, channels) 정의 — evidence 없는 페르소나는 스키마 위반 |
| 1-5 | 부트스트랩 절차(§4-8 A) SKILL.md 초안 작성 | `SKILL.md`의 STAGE 0 + 부트스트랩 섹션 | concerns→rules→personas 생성 순서, draft→사람 승인→승격 절차 명문화 |

**의존성**: 1-2 → 1-4 (personas 스키마는 concerns 격자 참조 필드 필요). 나머지는 병렬 가능.

### Phase 2 — 규제 검증 엔진 (기획서 Day 2)

**목표**: AI 판단 없이 코드만으로 카피 위반을 판정하는 `validate_copy.py` 완성.

| # | 작업 | 산출물 | 완료 기준 |
|---|------|--------|-----------|
| 2-1 | `validate_copy.py` 코어 구현 | 스크립트 | CLI: `--input {카피} --rules rules/{국가코드}.json`. 패턴 매칭(정규식 + 형태소 단위), 특정 언어 비종속 설계 |
| 2-2 | 한국어 개념 매핑 탐지 | 스크립트 내 매핑 로직 | 한국어 카피의 NG 개념 사전 탐지 (예: "재생" → 해당 룰 위반 예정 경고) |
| 2-3 | 출력 JSON 포맷 구현 | — | `verdict`, `violations[]`(rule_id, matched, position, severity, alternatives), `pass_rate` 반환 (기획서 §4-3) |
| 2-4 | 신선도 체크 구현 | — | 룰셋 `last_verified` 90일 초과 시 경고 플래그 반환 (§4-8 B) |
| 2-5 | 단위 테스트 | 테스트 스크립트/픽스처 | 임의 국가 테스트용 룰셋 픽스처로 알려진 위반 샘플("피부 재생", "美白" 등) 탐지 검증. 픽스처는 테스트 전용 경로에 두어 "사전 내장 없음" 원칙 유지 |

**의존성**: 1-3(rules 스키마) 완료 후 착수. 2-1 → 2-2/2-3/2-4 → 2-5.

### Phase 3 — 파이프라인 통합 (기획서 Day 3)

**목표**: SKILL.md STAGE 0~4 완성과 생성→검증 자가 루프, 보고서 템플릿 구현.

| # | 작업 | 산출물 | 완료 기준 |
|---|------|--------|-----------|
| 3-1 | SKILL.md STAGE 0 (국가 리졸브) | SKILL.md | 국가명→국가코드 변환, 3개 데이터 파일 존재 확인, 미존재 시 부트스트랩 분기. 국가 미지정 시 반드시 사용자에게 질문 |
| 3-2 | SKILL.md STAGE 1 (시장 스캔) | SKILL.md | web_search 쿼리 템플릿(지역·언어만 치환, 절차 고정), market_scan 요약 형식 |
| 3-3 | SKILL.md STAGE 2 (규제 검증) | SKILL.md | 스크립트 실행 강제 명시("AI 자체 판단 대체 금지", "룰셋 본문 컨텍스트 진입 금지") |
| 3-4 | SKILL.md STAGE 3 (파생 + 자가 루프) | SKILL.md | 제품 효능×concerns 셀 매칭 → 페르소나 동적 파생(개수 가정 금지) → 카피 생성 → 검증 재투입 → VIOLATION 시 재생성(최대 3회) → 전 카피 PASS 시에만 진행 |
| 3-5 | SKILL.md STAGE 4 (리포트 생성) | SKILL.md | 신호등 판정 로직(VIOLATION 미해결→🔴 / WARNING만→🟡 / 전체 PASS→🟢), 저장 규칙 `launchpass_report_{제품명}_{날짜}.html` |
| 3-6 | 신선도 체크·업데이트 절차(§4-8 B) SKILL.md 반영 | SKILL.md | source_urls 재조회 → diff 생성 → 사람 승인 → 버전 증가 절차, concerns 갱신 시 personas 재검토 표시 |
| 3-7 | `readiness_report.html` 템플릿 구현 | 템플릿 | 기획서 §4-7의 5개 섹션(헤더 신호등, 요약, 시장 스캔+격자 시각화, 규제 검증 결과표+통과율 게이지, 페르소나 카드+PASS 배지, 액션 아이템) + 데이터 버전·기준일 표기 |
| 3-8 | `.mcp.json` web_search 설정 | 설정 파일 | STAGE 1·부트스트랩에서 web_search 호출 가능 |

**의존성**: Phase 1·2 완료 후 착수. 3-1~3-6은 순차(하나의 SKILL.md), 3-7·3-8은 병렬 가능.

### Phase 4 — E2E 검증 및 제출 (기획서 Day 4)

**목표**: 실제 사례 기반 E2E 검증과 제출 패키징.

| # | 작업 | 산출물 | 완료 기준 |
|---|------|--------|-----------|
| 4-1 | E2E 실행 | `sample_run_log.md`, 생성된 보고서 | 테스트 국가 1개(예: 일본)를 실행 시 입력 → 부트스트랩(concerns/rules/personas draft 생성→승인)부터 HTML 리포트까지 전 과정 로그 기록. 국가 데이터가 실행 중 생성됐음이 로그로 입증될 것 |
| 4-2 | 실제 사례 검증 | 로그 | 링클핏 라인 실제 한국어 제품 설명 입력 → 위반 탐지 → 수정 → PASS 전환 과정 기록 |
| 4-3 | 자가 루프 검증 | 로그 | AI 생성 카피가 검증 엔진 100% 통과까지 재생성되는지 확인 |
| 4-4 | 예제 입력 작성 | `examples/sample_input_wrinklefit.md` | 제품 예제 입력 (국가는 실행 시 지정 형태) |
| 4-5 | README.md 작성 | README.md | 설치·실행 방법, 아키텍처 요약, 질문지 5문항 답변(기획서 §5 기반) |
| 4-6 | 로그 정리 + 패키징 | `logs/`, submission.zip | AI 대화 로그 무편집 포함, 기획서 §3 구조와 일치 |

**의존성**: Phase 3 완료 후 착수. 4-1 → 4-2 → 4-3 순차, 4-4·4-5 병렬 가능.

---

## 4. 검증 계획 (기획서 §5 Q5 대응)

| 검증 항목 | 방법 | 시점 |
|-----------|------|------|
| 룰셋 단위 테스트 | 테스트 픽스처 룰셋으로 알려진 위반 표현 탐지 확인 | Phase 2 (2-5) |
| 스키마 준수 | 부트스트랩 산출물이 `_schema.json` 3종을 만족하는지 검증 | Phase 3~4 |
| 실제 사례 검증 | 링클핏 실제 설명 → 위반 탐지 → 수정 → PASS 로그 | Phase 4 (4-2) |
| 자가 루프 검증 | 생성 카피 100% PASS까지 재생성 루프 동작 확인 | Phase 4 (4-3) |
| 국가 무종속 검증 | 저장소에 국가 데이터 파일 부재 확인 + 실행 중 생성 로그 | Phase 4 (4-1) |
| 토큰 효율 검증 | 검증 단계에서 룰셋 본문이 컨텍스트에 진입하지 않음을 로그로 확인 | Phase 4 (4-1) |

---

## 5. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 부트스트랩 시 web_search 결과 품질 저하(출처 부실) | concerns/rules 근거 약화 | 출처 못 찾은 룰은 `unverified` 플래그, 근거 없는 페르소나는 생성 금지 (스키마로 강제) |
| 다국어 패턴 매칭 한계(형태소 변형) | 위반 미탐지 | 정규식 + 개념 매핑 이중 탐지, 단위 테스트로 커버리지 확인 |
| 자가 루프 무한 반복 | 실행 지연 | 재생성 최대 3회 제한, 실패 시 🔴 판정으로 보고서에 명시 |
| 규제 데이터 시효 경과 | 판정 신뢰성 저하 | last_verified 90일 체크 + 보고서에 데이터 버전·기준일 상시 표기 |
| AI가 검증을 자체 판단으로 대체 | 신뢰성 붕괴 | SKILL.md에 스크립트 실행 강제 조항 명시(⚠️ 2회 반복 경고) |

---

## 6. 완료 정의 (Definition of Done)

- [ ] 저장소에 국가별 데이터 파일이 하나도 없고, `_schema.json` 3종만 존재한다.
- [ ] `validate_copy.py`가 단위 테스트를 통과하고, AI 개입 없이 JSON 판정을 반환한다.
- [ ] 임의 국가 입력 시 부트스트랩 → STAGE 1~4가 E2E로 동작하며 HTML 보고서가 생성된다.
- [ ] 생성 카피 전건이 검증 엔진 PASS 후에만 보고서에 실린다.
- [ ] 부트스트랩 산출물은 사람 승인 절차를 거쳐야만 정식 파일로 승격된다.
- [ ] submission.zip이 기획서 §3 구조와 일치하고, 로그가 무편집으로 포함된다.
