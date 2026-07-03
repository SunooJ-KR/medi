# 개발 프로세스 상세

작성일: 2026-07-03
상위 문서: `docs/plan.md`(설계, v2.1), `docs/inputs-and-scenarios.md`(입력·UX)
본 문서: 위 설계를 구현하는 **단계별 작업 순서, 산출물, 완료 기준(DoD), 검증 방법**을 정의한다. 구현 중 이 문서가 체크리스트가 된다.

---

## 1. 개발 원칙

1. **validate가 항상 먼저**: 어떤 기능도 검증 규칙(plan.md §4.5 V1~V6)보다 먼저 데이터를 쓰지 않는다. Phase 0에서 validate와 스키마를 완성한 뒤에야 데이터 생성 코드를 작성한다.
2. **목데이터로 병렬화**: 리포트 렌더러(Phase 4)는 추론 엔진(Phase 3)을 기다리지 않는다. Phase 0에서 만드는 픽스처(fixtures)가 두 트랙의 계약이다.
3. **스킬은 얇게, 스크립트는 두껍게**: 판단·대화는 SKILL.md(LLM)가, 검증·계산·렌더링은 `src/scripts/`(코드)가 담당한다. 재현 가능해야 하는 것은 전부 코드로 내린다.
4. **모든 Phase는 실행 가능한 상태로 끝난다**: 각 Phase의 DoD에 "실제 명령 실행" 검증이 포함된다. 중간 산출물도 커밋한다.
5. **데모 경로 우선**: 우선순위 충돌 시 S4(백테스트)·S1(주간 브리핑) 데모 경로에 필요한 것을 먼저 만든다.

## 2. 기술 스택과 실행 환경

| 항목 | 선택 | 이유 |
|---|---|---|
| 런타임 | Node.js (로컬 v24 확인됨) | Codex 스킬에서 `node src/scripts/*.mjs` 직접 호출 |
| 언어 | ESM JavaScript (`.mjs`) | 빌드 단계 불필요 |
| 의존성 | `js-yaml`, `ajv` 2개만 (`src/package.json`) | YAML 파싱, JSON Schema 검증. 그 외 무의존 — 데모 환경 리스크 최소화 |
| 차트 | 인라인 SVG 직접 생성 (라이브러리 없음) | 보고서 self-contained 요건(plan.md §6). 구현 시 dataviz 스킬 지침 적용 |
| LLM 호출 | 스킬(Codex 세션)이 직접 추론 — 별도 API 호출 코드 없음 | 플러그인 규격상 스킬이 곧 LLM 실행 컨텍스트. simulate 스킬이 추론하고, 결과 JSON을 스크립트로 검증·저장 |
| 데이터 | YAML(사람이 읽는 데이터), JSON(run 산출물 내부) | plan.md §3 |

디렉터리는 plan.md §5.2 확정안을 따른다. 작업 저장소는 이 리포(`ax/medi`) 자체를 사용하고, 플러그인 패키지는 `src/`에 만든다.

## 3. 단계별 프로세스

### Phase 0 — 스캐폴드·스키마·검증 (모든 것의 게이트)

**목표**: 데이터 계약을 확정하고, 이후 모든 Phase가 사용할 validate와 픽스처를 완성한다.

작업 순서:
1. `src/.codex-plugin/plugin.json` 작성 — 이름, 버전, 설명, 스킬 목록. 해커톤 규격 필드는 제출 전 재확인.
2. `src/package.json` + `npm install js-yaml ajv` (src 내부에서).
3. JSON Schema 3종 작성: `src/schemas/persona.schema.json`, `event.schema.json`, `reaction.schema.json`.
   - plan.md §4.2~4.4의 모든 필드·enum·필수 여부를 그대로 코드화.
   - event 스키마는 `kind`에 따라 조건부 필수(외부→`sources`·`date_collected`·`status: unreviewed|reviewed|rejected`, 내부→`status: planned|occurred`)를 `if/then`으로 표현.
4. `src/schemas/config.schema.json` 추가 (inputs-and-scenarios.md §3).
5. `data/taxonomy.yaml` 작성 — 공식몰 6개 고민 카테고리 + `home_device`, 각 항목에 성분·대표 제품 매핑 (research.md §5 근거).
6. `src/scripts/validate.mjs` 작성:
   - CLI: `node validate.mjs <파일|디렉터리>` → 스키마 검증 + 교차 규칙(V2 evidence≥1, V3 페르소나≤10, V5 sources≥1, 참조 무결성: reaction의 persona_id/event_id 존재 확인, concerns가 taxonomy에 존재 확인).
   - 출력: 통과/실패 + **필드 단위 사유**(inputs-and-scenarios.md §2.7 — 스킬이 이 메시지로 재질문한다).
   - 종료 코드: 0/1 (스킬과 테스트가 기계적으로 판정).
7. 픽스처 작성: `src/fixtures/`에 유효 샘플(페르소나 2, 내부/외부 이벤트 각 2, 반응 4)과 **의도적 불량 샘플**(V1~V6 각 1개씩) 저장.

**DoD**:
- [ ] `node src/scripts/validate.mjs src/fixtures/valid/` 전체 통과.
- [ ] 불량 픽스처 6종이 각각 해당 규칙 번호로 거부되고 사유 메시지가 사람이 읽을 수 있음.
- [ ] plugin.json이 규격 필수 요건 충족.

### Phase 1 — 온보딩과 페르소나 백본

**목표**: `/setup`, `/persona-build` 스킬 완성 + 실제 메디테라피 페르소나 6~8개 확정.

작업 순서:
1. SKILL.md 공통 골격 확정(§5) 후 `setup/SKILL.md` 작성 — 흐름은 inputs-and-scenarios.md §4.1. research.md 자동 감지 → config.yaml·taxonomy 초안 → 확인.
2. `data/config.yaml` 실제 생성 (경쟁사: 메디큐브/토리든/라운드랩 등 research.md §9 기반).
3. `persona-build/SKILL.md` 작성 — research.md·공식몰 카테고리에서 초안 생성, **속성마다 evidence 인용 강제**, 항목별 사용자 승인 후 confirmed 저장, 저장 전 validate 호출. `--refresh` 모드(기존 대비 diff 제안) 포함.
4. 실제 페르소나 6~8개 생성·검수 — plan.md §4.2의 후보 축 사용. 이것은 코드가 아니라 **콘텐츠 작업**이며 데모 품질을 좌우하므로 사람 검수에 시간을 배정한다.

**DoD**:
- [ ] 빈 폴더에서 `/setup` 실행 → config.yaml·taxonomy.yaml 생성, validate 통과.
- [ ] `/persona-build` → 초안 제시 → 승인 → `data/personas/*.yaml` 6개 이상, 전부 validate 통과.
- [ ] config 없는 상태에서 다른 스킬 실행 시 `/setup` 안내 후 중단(빈 상태 처리 — 스킬 골격 §5-2 확인).

### Phase 2 — 이벤트 파이프라인

**목표**: `/event-add`, `/event-scan` 완성. 검토 큐 UX 동작.

작업 순서:
1. `event-add/SKILL.md` — 자연어→구조화→한국어 병기 확인 표→중복 검사→validate→저장 (inputs-and-scenarios.md §4.2). `--external`(sources 필수), `--edit <id>`, `--confirm <id>`(planned→occurred) 모드.
2. 중복 검사 스크립트 `src/scripts/dedupe.mjs` — 같은 type + 날짜 ±7일 + 제목 토큰 유사 → 후보 목록 반환. (판단은 스킬이, 탐색은 코드가.)
3. `event-scan/SKILL.md` — config의 competitors/keywords/lookback으로 웹 조사, 출처 tier 부여, 기존 URL 스킵, unreviewed 저장, 검토 큐 테이블 출력, 번호 응답으로 status 일괄 갱신.
4. 백테스트용 과거 이벤트 데이터 작성: `evt_2025_qoo10_no1`(레티날 세럼 일본 Qoo10 1위), `evt_2025_amazon_mwf` — research.md §7.6의 출처 URL로 sources 구성. **Phase 5 데모의 원재료이므로 여기서 미리 만든다.**

**DoD**:
- [ ] `/event-add`로 내부 이벤트(occurred/planned 각 1) 생성, validate 통과.
- [ ] `/event-add --external` 실행 시 출처 URL 없으면 V5 사유로 재질문.
- [ ] `/event-scan` 실행 → unreviewed 저장 → 큐에서 승인/거부 → status 반영 확인.
- [ ] 같은 이벤트 재입력 시 중복 경고 발생.

### Phase 3 — 매칭·반응 추론 엔진 (최대 리스크 구간)

**목표**: `/simulate` 완성. B=MAP 구조화 추론의 품질 확보.

작업 순서:
1. `src/scripts/match.mjs` — 입력: lookback/`--since`/`--event`, 필터: V6(reviewed) + 내부 status + `active_until`. 출력: 추론 대상 (persona, event) 쌍 목록 JSON. 교집합 규칙: `affected_concerns ∩ persona.concerns ≠ ∅` AND market 일치 AND (채널 교집합 또는 이벤트 채널 미지정).
2. `simulate/SKILL.md` — 핵심 프롬프트 설계(§6). 쌍마다: 페르소나 카드 + 이벤트 + taxonomy 근거를 컨텍스트로 B=MAP 델타 JSON 생성 → validate(V4) → 실패 시 해당 쌍만 재추론(최대 2회) → `data/reactions/<run-id>/` 저장.
3. run 메타 파일(`run.yaml`: 실행 시각, 파라미터, 대상 이벤트 목록, 제외 사유) 저장 — 보고서와 diff의 기준점.
4. `--backtest <id>` 모드: 이벤트 발생일 이후 정보를 근거로 쓰지 말라는 제약을 프롬프트에 명시하고, run 메타에 backtest 플래그 기록(보고서가 비교 뷰로 렌더).
5. 콘솔 미니 요약: 상위 리스크/기회 3개 + confidence를 시뮬레이션 종료 시 즉시 출력.
6. **품질 캘리브레이션 루프**(이 Phase의 절반은 여기): 픽스처 페르소나 × 실제 이벤트로 10~20쌍 추론 → 사람이 읽고 "허구/과신/동어반복" 사례 수집 → 프롬프트 수정 → 재실행. 최소 3회 반복을 일정에 명시적으로 배정한다.

**DoD**:
- [ ] `/simulate` 기본 실행 → 매칭된 쌍 전부에 대해 validate 통과한 반응 저장.
- [ ] unreviewed 이벤트·lookback 밖 이벤트가 입력에 포함되지 않음(run 메타의 제외 사유로 확인).
- [ ] `--backtest evt_2025_qoo10_no1` 실행 → 결과가 실제 알려진 반응(리뷰·후속 보도) 방향과 정성적으로 부합 — 판정 기준: 팀원 검토에서 "그럴듯한 허구" 판정 0건.
- [ ] 델타 범위 밖·필드 누락 응답이 자동 재추론으로 회복됨.

### Phase 4 — HTML 보고서 (Phase 3과 병행 가능)

**목표**: `/report` 완성. 픽스처만으로 개발 시작.

작업 순서:
1. `src/scripts/aggregate.mjs` — run 로드 → 우선순위 점수 산출(plan.md §6-1 산출식) → 직전 보고서의 run과 diff(신규 이벤트, 델타 변경 쌍, 우선순위 변동) → 렌더용 단일 JSON.
2. `src/templates/report.html` — 5개 섹션 뼈대(요약/시각화/상세/변화 추적/한계 고지), 인라인 CSS/JS, 외부 요청 0.
3. `src/scripts/render.mjs` — aggregate JSON을 템플릿에 주입 → `reports/YYYY-MM-DD.html`. 같은 날짜 재실행 시 `-2` 접미사(멱등성).
4. 시각화 3종 인라인 SVG: 페르소나×이벤트 히트맵, 이벤트 타임라인, 고민별 기회-리스크 매트릭스. **차트 코드 작성 전 dataviz 스킬을 읽고 팔레트·마크 규칙 적용.**
5. 규칙 렌더 확인: confidence=low 흐림 처리, planned 배지, 근거 링크 전수, backtest run이면 실제-대-추론 비교 레이아웃.
6. `report/SKILL.md` — 스크립트 호출 + 결과 경로 안내 + 콘솔 요약.

**DoD**:
- [ ] 픽스처 run으로 보고서 생성 → 브라우저에서 5개 섹션 정상 표시, 네트워크 요청 0건(개발자도구 확인).
- [ ] 두 개 run으로 연속 생성 시 변화 추적 섹션에 diff 표시.
- [ ] low confidence 흐림·planned 배지·한계 고지 섹션이 실제로 렌더됨.
- [ ] HTML 파일 하나만 복사해 다른 PC에서 열어도 동일하게 보임.

### Phase 5 — /brief 오케스트레이션·데모 준비

**목표**: 주간 원커맨드 완성 + 데모 리허설.

작업 순서:
1. `brief/SKILL.md` — scan → 검토 큐 일시정지 → simulate → report → 콘솔 요약. 신규 이벤트 0건이면 시뮬레이션 스킵 여부 질문. **어떤 경로로도 V6를 우회하지 않는지 재검증.**
2. E2E 시나리오 체크리스트(§7.2) 전체 1회 통과.
3. 데모 데이터 확정: 검수된 페르소나 + 백테스트 이벤트 2건 + 내부 이벤트 샘플 → 데모용 초기 상태를 git 태그로 고정(`demo-baseline`).
4. 데모 스크립트 작성: S0 축약(사전 준비 데이터 설명) → **S4 백테스트**(핵심) → S1 diff 화면. 각 장면의 명령·예상 출력·소요 시간 기록.
5. 리허설 2회: 네트워크 없는 상황(스캔 실패) 대비 — 사전 수집된 외부 이벤트로 폴백하는 경로 확인.
6. README(플러그인 설치·실행 방법) 작성 — 심사자가 처음 실행하는 경로 기준.

**DoD**:
- [ ] `demo-baseline` 태그에서 `/brief` → 승인 → 보고서까지 무개입 통과.
- [ ] 데모 스크립트대로 리허설 시간 내 완료(할당 시간 -20% 여유).
- [ ] README만 보고 제3자가 설치·첫 실행 가능.

## 4. 스크립트 CLI 계약 (스킬 ↔ 코드 인터페이스)

모든 스크립트는 **stdout에 JSON, stderr에 사람용 메시지, 종료 코드 0/1** 규약을 따른다. 스킬이 파싱 실패로 헤매지 않게 하는 최소 계약이다.

| 스크립트 | 호출 | 출력(stdout JSON) |
|---|---|---|
| `validate.mjs` | `validate.mjs <경로>` | `{ok, errors:[{file, field, rule, message}]}` |
| `dedupe.mjs` | `dedupe.mjs --type --date --title` | `{candidates:[{id, similarity}]}` |
| `match.mjs` | `match.mjs [--since --event --backtest]` | `{pairs:[{persona_id, event_id}], excluded:[{event_id, reason}]}` |
| `aggregate.mjs` | `aggregate.mjs --run <id> [--prev <report>]` | 렌더용 통합 JSON |
| `render.mjs` | `render.mjs --run <id>` | `{path: "reports/....html"}` |

## 5. SKILL.md 공통 골격

모든 스킬은 같은 순서의 섹션으로 작성한다:

1. **전제조건 검사**: config/페르소나/이벤트 존재 확인 → 없으면 선행 스킬 안내 후 중단.
2. **입력 수집**: 필수 5필드 원칙, 자연어→구조화→확인 표(수동 입력 스킬만).
3. **실행**: 스크립트 호출 규약(§4), validate 실패 시 필드 단위 재질문.
4. **종료 보고**: 콘솔 요약 + 상태 기반 다음 단계 제안(체이닝).
5. **금지 사항 명시**: validate 우회 저장 금지, V6 우회 금지, 근거 없는 속성 생성 금지.

## 6. simulate 프롬프트 설계 지침

Phase 3 캘리브레이션의 시작점. 핵심 구조:

- **컨텍스트**: 페르소나 카드 전체(B=MAP 기준선 + evidence 원문 인용) + 이벤트(요약 + 출처) + 해당 고민의 taxonomy 항목. 무관한 페르소나·이벤트는 넣지 않는다(match가 이미 거름).
- **출력 강제**: reaction 스키마와 동일한 JSON만 출력. 델타는 "확실히 근거가 있을 때만 ±2, 애매하면 0"이라는 보수성 지침 명시.
- **근거 규율**: `rationale`은 반드시 컨텍스트로 제공된 evidence를 참조해야 하며, 새로운 사실 창작 금지. `evidence_refs`에 실제 사용한 근거 인덱스 기재.
- **confidence 자기평가 기준표** 제공: high=페르소나 evidence와 이벤트가 직접 연결 / medium=간접 연결 / low=일반 추론.
- **백테스트 모드 추가 제약**: "이벤트 발생일 이후의 어떤 정보도 알지 못한다고 가정하라"를 컨텍스트 최상단에 배치.

## 7. 테스트 전략

### 7.1 자동 테스트 (Node `--test`, `src/test/`)

- validate: 유효 픽스처 통과 + 불량 픽스처 6종이 정확한 규칙 번호로 거부 (Phase 0 DoD와 동일 케이스를 테스트로 고정).
- match: lookback 경계(8주±1일), unreviewed 제외, `active_until` 연장, `--event` 단일 선택.
- aggregate: 우선순위 산출식 수치 검증, diff(신규/변경/제거) 케이스.
- render: 생성 HTML에 외부 URL 참조 부재(정규식 검사), 5개 섹션 앵커 존재.

### 7.2 수동 E2E 체크리스트 (Phase 5에서 전체 1회)

시나리오 S0→S1→S2→S3→S4를 inputs-and-scenarios.md §5의 흐름대로 실행하고 각 단계의 기대 출력을 확인한다. 특히:
- [ ] S2: planned 입력→시뮬→`--edit`→재시뮬→`--confirm` 전환 전 과정.
- [ ] S3: 출처 누락 재질문 → URL 제공 → 단일 이벤트 콘솔 요약.
- [ ] S4: 백테스트 보고서의 실제-대-추론 비교 뷰.

### 7.3 LLM 산출물 품질 검사 (자동화 불가 구간)

Phase 3의 캘리브레이션 루프(3회 이상)가 곧 테스트다. 판정 기준을 명문화한다: ① 허구(컨텍스트에 없는 사실 인용) 0건 ② 전 쌍 동일 델타 같은 동어반복 없음 ③ suggested_actions가 이벤트·페르소나 특정적일 것(어느 쌍에나 붙는 일반론 불가).

## 8. git 워크플로

- 브랜치: Phase당 1개(`phase-0-schema`, …) → main 머지. 콘텐츠 작업(페르소나 검수)은 별도 커밋으로 코드와 분리.
- 커밋 단위: DoD 항목 단위. 데이터 파일(`data/`) 변경은 validate 통과 후에만 커밋.
- 태그: `demo-baseline`(Phase 5), 제출 시점 `submission`.

## 9. 리스크와 대응

| 리스크 | 징후 | 대응 |
|---|---|---|
| 추론 품질 미달 (최대) | 캘리브레이션 3회 후에도 허구/동어반복 잔존 | 페르소나 수를 6개로 축소하고 evidence 밀도를 올린다. 쌍당 컨텍스트를 늘리는 방향이 프롬프트 기교보다 효과적 |
| 플러그인 규격 해석 오류 | plugin.json 로드 실패 | Phase 0 완료 직후 최소 스킬 1개로 실제 Codex 로드 스모크 테스트를 앞당겨 수행 |
| 웹 조사 불안정 (데모 당일) | scan 타임아웃·빈 결과 | 사전 수집 외부 이벤트로 폴백 (Phase 5-5). 데모 핵심 경로(S4)는 스캔 비의존 |
| 페르소나 콘텐츠 시간 부족 | Phase 1 지연 | 후보 축 6개 중 데모 관련(고효능-자극 딜레마형, 리뷰·랭킹 추종형) 우선 완성 |
| HTML 용량 비대 | 보고서 로딩 지연 | evidence 원문은 접기(details), 반응 상세는 상위 N개만 즉시 렌더 |

## 10. Phase 의존 관계 요약

```
Phase 0 (스키마·validate·픽스처)
  ├─► Phase 1 (setup·페르소나) ─► Phase 2 (이벤트) ─► Phase 3 (추론)
  └─► Phase 4 (보고서, 픽스처로 병행) ──────────────────┘
                                                        ▼
                                              Phase 5 (brief·데모)
```
