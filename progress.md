# Progress — LaunchPass 개발 진행 관리

> 계획 문서: `strategies/dev-plan.md` (단위 작업 정의의 원본 — 산출물·완료 기준·의존성은 그쪽 참조)
> 본 문서는 **진행 상태만** 관리한다. 계획 변경은 `strategies/dev-plan.md`를 수정한 뒤 이 보드에 반영한다.

Active LLM: Claude Code

## 운영 지침

1. 작업 착수 시: 해당 단위 작업을 **다음 단계 → 현재 진행 중**으로 이동한다. 동시 진행은 의존성이 없는 작업만 허용한다.
2. 작업 완료 시:
   - `strategies/dev-plan.md`의 완료 기준을 충족했는지 확인한다.
   - 해당 작업을 **현재 진행 중 → 완료사항**으로 이동하고 완료일을 기록한다.
   - **git commit을 반드시 수행한다.** 커밋 메시지 형식: `[{작업번호}] {작업명 요약}` (예: `[1-2] concerns 스키마 설계`). 커밋에는 해당 작업 산출물과 progress.md 갱신을 함께 포함한다.
   - `## Task Log`에 한국어 엔트리를 추가한다.
3. 단위 작업 도중에는 커밋하지 않는다 (1 단위 작업 = 1 커밋 원칙).

---

## 현재 진행 중

- [ ] **2-2** 한국어 개념 매핑 탐지

## 다음 단계

### Phase 2 — 규제 검증 엔진
- [ ] **2-3** 출력 JSON 포맷 구현 _(2-1 후)_
- [ ] **2-4** 신선도 체크 구현 _(2-1 후)_
- [ ] **2-5** 단위 테스트 _(2-2~2-4 후)_

### Phase 3 — 파이프라인 통합 _(Phase 1·2 완료 후 착수)_
- [ ] **3-1** SKILL.md STAGE 0 (국가 리졸브)
- [ ] **3-2** SKILL.md STAGE 1 (시장 스캔)
- [ ] **3-3** SKILL.md STAGE 2 (규제 검증)
- [ ] **3-4** SKILL.md STAGE 3 (파생 + 자가 루프)
- [ ] **3-5** SKILL.md STAGE 4 (리포트 생성)
- [ ] **3-6** 신선도 체크·업데이트 절차 SKILL.md 반영
- [ ] **3-7** `readiness_report.html` 템플릿 구현 _(3-1~3-6과 병렬 가능)_
- [ ] **3-8** `.mcp.json` web_search 설정 _(병렬 가능)_

### Phase 4 — E2E 검증 및 제출 _(Phase 3 완료 후 착수)_
- [ ] **4-1** E2E 실행 (부트스트랩→리포트, 로그 기록)
- [ ] **4-2** 실제 사례 검증 (링클핏) _(4-1 후)_
- [ ] **4-3** 자가 루프 검증 _(4-2 후)_
- [ ] **4-4** 예제 입력 작성 _(병렬 가능)_
- [ ] **4-5** README.md 작성 _(병렬 가능)_
- [ ] **4-6** 로그 정리 + submission.zip 패키징 _(최종)_

## 완료사항

- [x] **P0-1** `strategies/plan.md` 기획서 확정 — 2026-07-07
- [x] **P0-2** `strategies/dev-plan.md` 개발 계획서 작성 — 2026-07-07
- [x] **P0-3** `progress.md` 작업 보드 구성 및 지침 문서 업데이트 — 2026-07-07
- [x] **1-1** 디렉토리 구조 및 `plugin.json` 셋업 — 2026-07-07
- [x] **1-2** `concerns/_schema.json` 설계 — 2026-07-07
- [x] **1-3** `rules/_schema.json` 설계 — 2026-07-07
- [x] **1-4** `personas/_schema.json` 설계 — 2026-07-07
- [x] **1-5** 부트스트랩 절차 SKILL.md 초안 작성 — 2026-07-07 **(Phase 1 완료)**
- [x] **2-1** `validate_copy.py` 코어 구현 — 2026-07-07

---

## Task Log

### 2026-07-07 — [2-1] validate_copy.py 코어 구현

- **Task**: 룰셋 기반 카피 위반 탐지 코어 구현 (기획서 §4-3, dev-plan 2-1)
- **LLM**: Claude Code
- **Summary**: `src/scripts/validate_copy.py` 생성. 표준 라이브러리만 사용. `load_ruleset`(디스크에서 룰셋 직접 로드), `split_sentences`(한/일/영 공통 종결부호 분리, 형태소 분석기 비의존), `find_violations`(각 룰 ng_patterns를 정규식 우선→부분문자열 폴백으로 매칭, 위치 인덱스 기록) 구현. `Match` dataclass로 rule_id/matched/pattern/position/severity/alternatives/source 보관. CLI `--input`|`--input-file` + `--rules` 상호배타 인자. 후속 확장 지점 명시(2-2 개념매핑용 source 필드, 2-3 verdict/pass_rate, 2-4 신선도)
- **Files changed**: `src/scripts/validate_copy.py` (신규), `progress.md`
- **Checks run**: 임시 룰셋(스크래치패드)으로 실행 → 리터럴 패턴("재생" VIOLATION, "최고" WARNING)과 정규식 패턴(`No\.?1`→"No1") 모두 탐지, position/문장수 정확 확인 (완료 기준: CLI·패턴매칭·언어비종속 충족)
- **Result**: 완료
- **Open issues**: 현재 출력은 코어 매칭 결과(matches)만 반환. verdict/pass_rate 최종 포맷은 2-3에서 확정
- **Next**: 2-2 한국어 개념 매핑 탐지

### 2026-07-07 — [1-5] 부트스트랩 절차 SKILL.md 초안 작성 (Phase 1 완료)

- **Task**: SKILL.md에 STAGE 0(국가 리졸브)과 부트스트랩 섹션 작성 (기획서 §4-6, §4-8 A)
- **LLM**: Claude Code
- **Summary**: `src/skills/launchpass/SKILL.md` 생성. 핵심 원칙, 트리거, STAGE 0(국가명→alpha-2 코드 변환, 3개 파일 존재 확인, 미존재 시 부트스트랩 분기, 스키마·90일 신선도 체크) 작성. 부트스트랩은 **concerns→rules→personas 순서**와 각 단계의 evidence/source_urls 필수·`verified_by:ai` 초안 규칙, **draft→사람 승인→승격(verified_by:human)** 절차 명문화. 신선도·업데이트(diff 승인) 절차 포함. STAGE 1~4는 Phase 3에서 작성 예정임을 문서에 명시
- **Files changed**: `src/skills/launchpass/SKILL.md` (신규), `progress.md`
- **Checks run**: 없음 (절차 문서). 완료 기준(생성 순서·승격 절차 명문화) 충족 확인
- **Result**: 완료 — **Phase 1 전체 완료 (1-1~1-5)**
- **Open issues**: `jsonschema` 로컬 설치 상태 (requirements 명시는 Phase 2에서 반영 예정)
- **Next**: Phase 2 착수 — 2-1 validate_copy.py 코어 구현

### 2026-07-07 — [1-4] personas/_schema.json 설계

- **Task**: concerns 격자에서 파생되는 페르소나 스키마 정의 (기획서 §4-5)
- **LLM**: Claude Code
- **Summary**: JSON Schema draft 2020-12로 `market`, `version`, `last_verified`, `verified_by`, `derived_from`(파생 원천 concerns 파일·버전 추적), `personas[]`(id, **age_band**, **linked_concerns**(파생 근거), label, description, **evidence 필수**, copy_direction, channels) 정의. evidence·linked_concerns 없으면 스키마 위반 → "근거 없는 페르소나 생성 금지" 강제. 페르소나 개수는 minItems만 두어 가변 허용
- **Files changed**: `src/personas/_schema.json` (신규), `progress.md`
- **Checks run**: `check_schema` 통과 / 유효 인스턴스 PASS / evidence 누락 거부 / linked_concerns 누락 거부 확인 (완료 기준 충족). 스키마 3종(concerns/rules/personas) 완비 확인
- **Result**: 완료
- **Open issues**: 없음
- **Next**: 1-5 부트스트랩 절차 SKILL.md 초안 작성 (Phase 1 마지막)

### 2026-07-07 — [1-3] rules/_schema.json 설계

- **Task**: 국가별 화장품 광고 규제 룰셋 스키마 정의 (기획서 §4-2)
- **LLM**: Claude Code
- **Summary**: JSON Schema draft 2020-12로 `market`, `version`, `last_verified`, `verified_by`, `legal_basis`, `source_urls`(최소 1), `rules[]`(id 패턴 `XX-000`, category, ng_patterns 최소 1, severity `VIOLATION|WARNING`, reason, condition, alternatives, unverified 플래그) 정의. `additionalProperties:false`로 스키마 고정. validate_copy.py가 소비할 계약을 확정
- **Files changed**: `src/rules/_schema.json` (신규), `progress.md`
- **Checks run**: `check_schema` 통과 / 유효 인스턴스 PASS / 잘못된 severity 거부 / ng_patterns 누락 거부 확인 (완료 기준 충족)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: 1-4 personas/_schema.json 설계

### 2026-07-07 — [1-2] concerns/_schema.json 설계

- **Task**: 국가×나이대×피부고민 격자 스키마 정의 (기획서 §4-4)
- **LLM**: Claude Code
- **Summary**: JSON Schema draft 2020-12로 `market`(alpha-2 패턴), `version`(semver), `last_verified`(date), `verified_by`(ai|human), `age_bands`, `grid[]`(age_band, top_concerns, **evidence 필수**, kbeauty_affinity enum) 정의. `additionalProperties:false`로 스키마 외 필드 차단. evidence 없는 셀은 스키마 위반이 되도록 강제
- **Files changed**: `src/concerns/_schema.json` (신규), `progress.md`
- **Checks run**: `jsonschema` 설치 후 `check_schema` 통과 / 유효 인스턴스 PASS / evidence 누락 인스턴스 거부 확인 (완료 기준 충족)
- **Result**: 완료
- **Open issues**: `jsonschema` 파이썬 패키지를 로컬에 설치함 (스키마 검증용). 추후 requirements 명시 필요
- **Next**: 1-3 rules/_schema.json 설계

### 2026-07-07 — [1-1] 디렉토리 구조 및 plugin.json 셋업

- **Task**: dev-plan.md §2 산출물 구조에 맞춘 `src/` 디렉토리 골격과 `plugin.json` 생성
- **LLM**: Claude Code
- **Summary**: `src/` 하위에 `.codex-plugin`, `skills/launchpass`, `rules`, `concerns`, `personas`, `scripts`, `templates`, `examples` 생성. 기획서 §4-1 메타데이터 그대로 `plugin.json` 작성. 빈 디렉토리는 `.gitkeep`으로 보존
- **Files changed**: `src/.codex-plugin/plugin.json` (신규), `src/**/.gitkeep` (신규), `progress.md`
- **Checks run**: `python -c json.load` — plugin.json 유효 JSON 확인 / `find src/{rules,concerns,personas} -name *.json` — 국가별 데이터 파일 부재 확인 (완료 기준 충족)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: 1-2 concerns/_schema.json 설계

### 2026-07-07 — dev-plan.md 개발 계획서 작성

- **Task**: `strategies/plan.md` 기반 개발 계획 문서 작성
- **LLM**: Claude Code
- **Summary**: 기획서의 4일 일정을 Phase 1~4로 구조화하고, 작업 항목별 산출물·완료 기준·의존성, 검증 계획, 리스크 대응, 완료 정의(DoD)를 포함한 `dev-plan.md` 작성 (이후 사용자가 `strategies/`로 이동)
- **Files changed**: `strategies/dev-plan.md` (신규), `progress.md` (로그 추가)
- **Checks run**: 없음 (문서 작업)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: Phase 1 착수

### 2026-07-07 — progress.md 작업 보드 재구성 + 지침 업데이트

- **Task**: `strategies/dev-plan.md` 기반 단위 작업 보드(현재 진행 중 / 다음 단계 / 완료사항) 구성, 단위 작업당 git commit 규칙 수립
- **LLM**: Claude Code
- **Summary**: dev-plan.md의 Phase 1~4 전체 단위 작업(1-1~4-6)을 체크리스트로 등재하고 의존성을 표기. 운영 지침에 "1 단위 작업 = 1 커밋" 원칙과 커밋 메시지 형식(`[{작업번호}] {요약}`)을 명문화. CLAUDE.md·AGENTS.md에 동일 규칙 반영
- **Files changed**: `progress.md`, `CLAUDE.md`, `AGENTS.md`
- **Checks run**: 없음 (문서 작업)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: Phase 1 착수 (1-1 디렉토리 구조 및 plugin.json 셋업부터)
