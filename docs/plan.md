# 페르소나 × 이벤트 고객반응 시뮬레이션 플러그인 — 설계 계획서

작성일: 2026-07-03 (v2 — 오류 대응책 설계 반영, 플러그인 규격 확정)
대상: 메디테라피(MEDITHERAPY) — 근거는 `docs/research.md`
목적: 해커톤용 Codex 플러그인. 회사 내부/외부 이벤트가 피부고민별 고객 페르소나의 의사결정에 미치는 영향을 구조적으로 추론하고, 웹에서 볼 수 있는 HTML 보고서로 출력한다.
상태: **계획 확정 — 구현 착수 가능.** 의사결정 이력은 §9 참조.

---

## 1. 문제 정의 (사용자 가설 요약)

1. 뷰티 산업은 트렌드/제품은 빠르게 바뀌지만 고객이 겪는 문제는 크게 변하지 않는다.
2. 피부 고민은 제품 하나로 해결되지 않아 고객은 계속 더 좋은 제품을 탐색한다.
3. 고객 안에도 여러 계층이 있다.
4. 페르소나를 다차원으로 세분화하고 피부고민 그룹으로 묶어, 피부고민–제품–마케팅 접근을 세분화하고 싶다.
5. 시장 이해관계자가 너무 많아 사람이 모든 정보를 고려하면 누락이 생긴다.
6. 3축 모델: (1) 회사 내부 이벤트 = 직접 입력, (2) 외부 이벤트 = 자동 조사, (3) 페르소나별 행동심리학 기반 의사결정–반응 = 출력.
7. 출력 포맷: 요약 + 시각화 + 상세로 구성된 HTML 보고서.

## 2. 가설 검토와 대응 설계

### 2.1 타당한 점

- **가설 1·2는 research.md로 입증된다.** 메디테라피 공식몰의 고민별 카테고리(민감/진정, 모공, 잡티/미백, 주름/탄력, 건조/보습, 트러블)는 수년째 안정적이고, 브랜드 스토리 자체가 "고효능 vs 매일 사용성"이라는 불변의 트레이드오프를 문제로 정의한다. 반면 제품(레티날→PDRN→…)과 채널(TikTok, Qoo10 랭킹)은 빠르게 회전한다. "문제는 고정, 해법은 회전"이라는 관찰은 정확하다.
- **가설 5도 실재하는 문제다.** 채용공고 기준 메디테라피는 메타/틱톡 성과 지표, 국가별 인플루언서, 플랫폼 이벤트, 규제를 동시에 다루며, 이 정보량은 개인의 처리 한계를 넘는다.
- **3축 분해(내부/외부/고객반응)는 올바른 구조다.** 통제 가능한 변수(내부), 관측만 가능한 변수(외부), 추론 대상(반응)을 분리한 것은 시스템 설계 관점에서 맞는 절단이다.

### 2.2 오류·누락과 적용된 대응 장치 (추적표)

각 오류/누락의 대응은 아래 표의 "설계 장치" 열로 이 문서의 구체 설계에 **전부 반영 완료**했다. 구현 시 이 표가 검수 체크리스트가 된다.

| # | 오류/누락 | 설계 장치 (강제 수단) | 적용 위치 |
|---|---|---|---|
| E1 | 반응 예측에 정답 데이터가 없음 → 그럴듯한 허구 위험 | ① reaction 스키마에 `confidence`·`evidence_refs` **필수 필드** ② `/simulate --backtest` 모드 1급 기능 ③ 보고서에 한계 고지 섹션 상시 포함 ④ 낮은 확신도는 흐리게 렌더 | §4.4, §5.2(simulate), §6-3·5, §7 |
| E2 | 다차원 세분화의 조합 폭발 → 근거 없는 셀 = 허구 | ① 페르소나 **상한 10개**(validate가 초과 시 실패) ② 속성별 `evidence` 최소 1개 없으면 validate 거부 ③ 셀 전개 대신 규칙 매칭으로 페르소나-이벤트 쌍만 추론 | §4.2, §4.5(V2·V3), §3 |
| E3 | "문제 불변"(가설1) vs "반응 변화"(가설6) 충돌 | 불변 백본(taxonomy, personas — 느린 갱신) / 동적 오버레이(events, reactions — 매 실행) **디렉터리·갱신주기 분리** | §3, §4.1–4.4, §5.3 |
| E4 | 프레임워크 없는 "행동심리학" = 서사 장식 | ① 페르소나에 `bmap_baseline`(Fogg B=MAP) 필수 ② 반응 `deltas`를 **정수 -2..+2로 강제**(validate) ③ 자유서술은 `rationale` 한 필드로 제한 | §4.2, §4.4, §4.5(V4) |
| E5 | 내부 이벤트 자유 입력 → 추론 일관성 붕괴 | ① 이벤트 `type` **enum 고정** ② `/event-add`가 대화형으로 스키마를 채우고 저장 전 validate 통과 필수 | §4.3, §4.5(V1), §5.2 |
| E6 | 외부 자동 조사의 환각·홍보성 기사·시점 오염 | ① `sources` 1개 이상 없으면 **validate 거부** ② 출처 4등급(`official/press/community/db`) ③ `date_occurred`/`date_collected` 분리 ④ `status: unreviewed`는 시뮬레이션에서 **자동 제외**(승인 게이트) | §4.3, §4.5(V5·V6), §5.2 |
| M1 | 이해관계자(경쟁사·플랫폼·규제·인플루언서) 축 부재 | 별도 축 신설 대신 외부 이벤트 `type` enum으로 흡수: `competitor_*`, `platform_*`, `regulation`, `influencer_issue` | §4.3 |
| M2 | 반응 나열로 끝나면 실무 가치 없음 | ① reaction 스키마에 `suggested_actions` **필수** ② 보고서 요약 = "대응 우선순위 Top 3"(산출식 §6-1) | §4.4, §6-1 |

## 3. 시스템 설계 개요

```
[백본 — 느리게 변함]                [오버레이 — 매 실행 변함]
피부고민 택소노미 ─┐               내부 이벤트 (직접 입력, E5 게이트)
페르소나 라이브러리 ─┤                외부 이벤트 (자동 조사 → 검토 큐, E6 게이트)
                  │                        │
                  └────► 매칭 (규칙 기반) ◄─┘
                            │  concerns/market/channels 교집합이 있는 쌍만 (E2)
                            ▼
                     반응 추론 엔진 (LLM)
                     B=MAP 정수 델타 + 근거 + 확신도 (E1, E4)
                            ▼
                     validate → 집계 → 이전 스냅샷 diff
                            ▼
                 HTML 보고서 (우선순위 요약 + 시각화 + 상세 + 변화 + 한계고지)
```

- **매칭을 규칙 기반으로 먼저 거는 이유**: 모든 페르소나 × 모든 이벤트를 LLM에 넣으면 비용이 조합적으로 늘고 무관한 쌍에서 허구가 생긴다. 이벤트의 `affected_concerns / market / channels`와 페르소나 속성이 겹치는 쌍만 추론한다.
- **모든 데이터는 작업 저장소 안의 파일(YAML/JSON)**: git으로 이력·diff·리뷰가 되고, "변화 추적" 데모가 쉽다. DB는 해커톤 범위에서 불필요.
- **모든 산출물은 저장 전 validate를 통과해야 한다**: 대응 장치의 강제 수단이 프롬프트 지시가 아니라 코드 검증이 되도록 한다(§4.5).

## 4. 데이터 모델

### 4.1 피부고민 택소노미 (`data/taxonomy.yaml`) — 백본

공식몰 카테고리를 그대로 채택해 근거를 확보한다: `sensitive_soothing`(민감/진정), `pores`(모공), `pigmentation`(잡티/미백/흔적), `wrinkle_elasticity`(주름/탄력), `dryness`(건조/보습), `trouble`(트러블) + 횡단 관심사 `home_device`(홈케어 디바이스). 각 항목에 관련 성분(레티날, 트라넥삼산…)과 대표 제품을 매핑한다.

### 4.2 페르소나 (`data/personas/*.yaml`) — 백본

```yaml
id: p03_sensitive_retinal_curious
name: "고효능은 원하지만 자극이 무서운 20대 후반 민감성"
market: KR                      # KR | US | JP | SEA (v1은 KR만 채움)
concerns: [pigmentation, sensitive_soothing]
demographics: { age_band: "25-34", price_band: mid }
channels: [olive_young, own_mall, instagram]
bmap_baseline:                  # E4: Fogg B=MAP 기준선 — 필수
  motivation: "흔적/톤 개선 욕구 높음. 자극 경험으로 손실 회피 성향 강함"
  ability: "성분 지식 중간. 루틴 단순해야 지속. 가격 민감 중간"
  prompt: "실사용 후기·전후사진에 반응. 환불 보장이 시도 장벽을 낮춤"
evidence:                       # E2: 최소 1개 필수, 없으면 validate 거부
  - { source: "https://meditherapy.co.kr/...", quote: "레티날...자극이 걱정되는", type: official }
  - { source: "(올리브영 리뷰 인용)", quote: "...", type: community }
confidence: medium
notes: "research.md 문제1·문제2에 직접 대응하는 핵심 페르소나"
```

v1 목표: **KR 시장 6~8개, 상한 10개(validate 강제).** 후보 축: 고효능-자극 딜레마형 / 복합고민 루틴 탐색형 / 홈에스테틱 디바이스형(피부과 대체) / 가성비 대용량형 / 리뷰·랭킹 추종형 / 선물·이벤트 구매형. 각각 research.md §8의 문제 1~4에 최소 하나 이상 연결되어야 한다. 다차원성은 페르소나 속성으로 보존하되 셀 단위 전개는 하지 않는다(E2).

내부 데이터 확장 슬롯: `evidence.type`에 `internal`을 예약해 두어, 회사가 CRM/구매 데이터를 연결할 때 스키마 변경 없이 근거 유형만 추가하면 된다.

### 4.3 이벤트 (`data/events/internal/*.yaml`, `data/events/external/*.yaml`) — 오버레이

```yaml
id: evt_2026_07_competitor_x
kind: external                  # internal | external
type: competitor_launch         # 아래 enum 참조 (E5)
title: "경쟁사 A, 저자극 레티날 세럼 출시"
date_occurred: 2026-06-28
date_collected: 2026-07-03      # 외부 이벤트만 (E6: 발생일/수집일 분리)
market: KR
affected_concerns: [pigmentation, sensitive_soothing]
affected_channels: [olive_young]
summary: "..."
sources:                        # E6: 외부 이벤트는 1개 이상 필수
  - { url: "...", tier: press } # official | press | community | db
status: reviewed                # unreviewed | reviewed | rejected (E6: 승인 게이트)
```

- 내부 이벤트 type: `product_launch, reformulation, price_change, promotion, campaign, stockout, pr_issue, channel_entry`
- 외부 이벤트 type: `competitor_launch, competitor_promotion, platform_policy, platform_event, regulation, ingredient_trend, influencer_issue, seasonal, macro`
  (→ M1: 경쟁사·플랫폼·규제기관·인플루언서가 전부 여기에 흡수된다)
- 내부 이벤트 status: `planned | occurred` — 실행 전 사전 점검(inputs-and-scenarios.md S2) 지원. planned는 보고서에서 구분 배지, diff 통계·백테스트에서 제외.
- 외부 이벤트는 자동 조사 외에 수동 입력 경로(`/event-add --external`, 출처 URL 필수)도 허용 — 긴급 대응 시나리오(S3).
- 시간 모델: simulate는 기본 lookback 8주 내 이벤트만 입력으로 사용(`--since`로 조정), 장기 유효 이벤트는 선택 필드 `active_until`로 연장.

### 4.4 반응 (`data/reactions/<run-id>/*.yaml`) — 시뮬레이션 출력

```yaml
persona_id: p03_sensitive_retinal_curious
event_id: evt_2026_07_competitor_x
deltas: { motivation: +1, ability: 0, prompt: +1 }   # E4: 각 -2..+2 정수, validate 강제
direction: risk                 # opportunity | risk | neutral
predicted_behaviors:
  - "올리브영에서 두 제품 비교, 리뷰 수·자극 언급 비율로 판단"
suggested_actions:              # M2: 필수 — 비어 있으면 validate 거부
  - "자사 레티날 세럼의 '민감성 실사용 후기' UGC를 올리브영 리뷰 상단에 배치"
confidence: medium              # E1: low | medium | high 필수
rationale: "손실 회피 성향상 신제품으로 즉시 이탈보다 비교 탐색..."   # E4: 자유서술은 이 필드 하나
evidence_refs: [persona.evidence[0], event.sources[0]]              # E1: 필수
```

델타를 정수로 강제하는 이유: 히트맵 시각화와 회차 간 비교가 가능해지고, LLM의 서사 편향을 수치 판단으로 압박할 수 있다.

### 4.5 검증 규칙 (`src/scripts/validate.mjs` — 저장 전 필수 통과)

| 규칙 | 내용 | 위반 시 | 대응 |
|---|---|---|---|
| V1 | 이벤트 `type`은 enum 밖 값 불가, 필수 필드 누락 불가 | 저장 거부 | E5 |
| V2 | 페르소나 `evidence` 0개 불가 | 저장 거부 | E2 |
| V3 | confirmed 페르소나 총수 > 10 | validate 실패 | E2 |
| V4 | `deltas` 정수 -2..+2 외 값, `confidence`/`suggested_actions`/`evidence_refs` 누락 | 반응 폐기 후 재추론 | E1·E4·M2 |
| V5 | 외부 이벤트 `sources` 0개 | 저장 거부 | E6 |
| V6 | `status != reviewed`인 이벤트 | simulate 입력에서 자동 제외 | E6 |

## 5. 플러그인 구조 (해커톤 공식 규격 반영 — 확정)

### 5.1 규격 요건

- 플러그인 루트 전체가 `src/` 안에 위치.
- `src/.codex-plugin/plugin.json` 필수.
- 동작 구성 요소 1개 이상: **스킬(SKILL.md) 7개**를 기본으로 하고, 실행 코드는 `src/scripts/`의 Node 스크립트로 제공(스킬이 호출). MCP 서버는 범위에서 제외 — 스킬+스크립트로 충분하며 데모 안정성이 높다.
- `src/` 내부 구조는 자유.

### 5.2 패키지 레이아웃

```
src/
  .codex-plugin/
    plugin.json            # 필수 매니페스트: 이름/버전/설명/스킬 경로
  skills/
    setup/SKILL.md         # 최초 설정: config.yaml·taxonomy.yaml 초안 생성 → 확인
    persona-build/SKILL.md # 공개 자료→페르소나 초안 생성/갱신, 검수 후 confirmed
    event-add/SKILL.md     # 이벤트 자연어 입력 → 구조화 확인 → validate → 저장 (E5, --external/--edit/--confirm)
    event-scan/SKILL.md    # 외부 이벤트 웹 조사 → unreviewed 저장 + 검토 큐 (E6)
    simulate/SKILL.md      # 매칭→반응 추론→validate→run 저장. --event/--backtest/--since (E1)
    report/SKILL.md        # 최신 run 기준 HTML 생성 + 직전 회차 diff
    brief/SKILL.md         # 주간 원커맨드: scan→검토 일시정지→simulate→report
  scripts/
    validate.mjs           # §4.5 규칙 (모든 스킬이 저장 전 호출)
    match.mjs              # 규칙 매칭: concerns/market/channels 교집합
    aggregate.mjs          # run 집계 + 직전 run diff 산출
    render.mjs             # templates/report.html에 데이터 주입 → 단일 HTML
  schemas/
    persona.schema.json
    event.schema.json
    reaction.schema.json
  templates/
    report.html            # 인라인 CSS/JS 뼈대 (외부 CDN 없음)
```

**플러그인 패키지(src/)와 런타임 데이터(작업 디렉터리)의 분리**: 스킬은 실행된 작업 폴더에 `data/`, `reports/`를 생성·관리한다. 플러그인은 코드·스키마·템플릿만 담고, 회사별 데이터는 사용자의 저장소에 남아 git 이력이 된다(E3의 백본/오버레이 분리도 이 데이터 폴더 안에서 유지).

```
<작업 저장소>/
  data/
    config.yaml        # 회사 프로필·경쟁사·채널·스캔 범위 (inputs-and-scenarios.md §3)
    taxonomy.yaml
    personas/          # 백본 (느린 변경, git 추적)
    events/internal/   # 오버레이
    events/external/
    reactions/<run>/
  reports/             # 날짜별 self-contained HTML
  docs/                # research.md, plan.md
```

### 5.3 스킬 5개 요약

| 스킬 | 역할 | 적용되는 게이트 |
|---|---|---|
| `setup` | 회사 프로필(config.yaml)·택소노미 초안 생성 → 사용자 확인. 타 스킬의 전제조건 | — |
| `persona-build` | research.md·리뷰·공식몰에서 페르소나 초안 생성, 사람이 검수해 confirmed | V2, V3 |
| `event-add` | 이벤트 자연어 입력 → 구조화 확인 → 저장. `--external`(수동 외부), `--edit`, `--confirm`(planned→occurred) | V1, V5 |
| `event-scan` | 외부 이벤트 자동 조사, 출처 인용·등급 부여, unreviewed로 저장 + 검토 큐 | V1, V5 |
| `simulate` | reviewed 이벤트만 입력, 매칭 후 쌍별 B=MAP 구조화 추론. `--event`, `--backtest`, `--since`. 종료 시 콘솔 미니 요약 | V4, V6 |
| `report` | HTML 보고서 생성, 직전 보고서와 diff 섹션 포함 | — |
| `brief` | 주간 원커맨드 오케스트레이션. 유일한 일시정지는 검토 큐 — 승인 게이트는 자동화하지 않음 | V6 유지 |

입력 플로우·시나리오 상세는 `docs/inputs-and-scenarios.md` 참조.

## 6. HTML 보고서 설계

self-contained 단일 HTML(인라인 CSS/JS, 외부 CDN 없음 — 파일 하나로 공유 가능). 5단 구성:

1. **요약 (경영진용, 스크롤 없이)** — 이번 회차 핵심 3줄 + **대응 우선순위 Top 3** (산출식: `|motivation delta + prompt delta| × confidence 가중(high=1.0/med=0.6/low=0.3) × 영향 페르소나 수`, M2) + 신규/승인대기 이벤트 수.
2. **시각화** — (a) 페르소나 × 이벤트 히트맵: 셀 = 동기+계기 델타 합, 색 = 기회/리스크. (b) 이벤트 타임라인(내부/외부 색 구분). (c) 피부고민별 기회–리스크 매트릭스. 차트는 인라인 SVG 직접 렌더(라이브러리 불필요, 구현 시 dataviz 스킬 적용).
3. **상세** — 페르소나 카드(B=MAP 기준선 + 근거 인용), 이벤트 카드(출처 링크·등급 배지), 반응 상세(델타, rationale, suggested_actions, confidence 배지). **모든 주장 옆에 근거 링크**(E1) — "공개 자료로 입증"이라는 원래 목표의 UI 표현. **confidence=low인 반응은 흐리게(저채도·저대비) 렌더**해 과신을 UI에서 구조적으로 방지.
4. **변화 추적** — 직전 보고서 대비: 신규 이벤트, 델타가 바뀐 페르소나-이벤트 쌍, 우선순위 변동(E3 — 반복 사용 가치의 핵심).
5. **한계 고지 (상시 포함, E1)** — 합성 페르소나의 한계, 홍보성 기사 위험, unreviewed 이벤트 수 등 research.md §13을 그대로 노출.

## 7. 신뢰성·검증 전략과 데모 시나리오

1. **데모는 백테스트 단독으로 확정** (가상 미래 이벤트 미포함 — §9 결정 2). 시나리오: 2025년 실제 이벤트(레티날 세럼 일본 Qoo10 종합 1위 / Amazon Most Wished For 세럼 1위, research.md §7.6)를 과거 시점 이벤트로 입력 → `/simulate --backtest` → 시스템의 페르소나 반응 추론을 이후 실제 보도·리뷰 반응과 나란히 표시. "미래 예측기"가 아니라 **"검증된 추론 절차"**로 프레이밍한다.
2. **근거 인용률 100%**: V2·V5로 코드 강제 — 프롬프트 지시가 아니라 validate가 거부한다.
3. **확신도 3단계 표기 + 낮은 확신 흐림 렌더**: V4 + §6-3.
4. **사람 검토 게이트**: V6 — unreviewed 외부 이벤트는 시뮬레이션 미반영.
5. **한계 고지 섹션 상시 포함**: §6-5.

## 8. 구현 로드맵

| 단계 | 내용 | 산출물 |
|---|---|---|
| 0 | 플러그인 스캐폴드(`src/.codex-plugin/plugin.json`, 스킬 뼈대) + 스키마·택소노미 + validate | plugin.json, schemas/, taxonomy.yaml, validate.mjs |
| 1 | KR 페르소나 6~8개 (LLM 초안 + 수작업 검수, 근거 인용) | data/personas/*.yaml |
| 2 | 이벤트 파이프라인 (`event-add`, `event-scan`, 검토 큐) | events/, 스킬 2종 |
| 3 | 매칭 + 반응 추론 엔진 (`simulate`, B=MAP 구조화 출력, --backtest) | match.mjs, reactions/ |
| 4 | HTML 리포트 렌더러 (`report`, diff 포함) | render.mjs, templates/, reports/*.html |
| 5 | 백테스트 데모 시나리오 구성 + 리허설 | 데모 스크립트 |

리스크 순서상 3(추론 품질)과 1(페르소나 근거)이 병목이므로, 4(리포트)는 목데이터로 병행 개발 가능. 단계 0의 validate가 이후 모든 단계의 게이트이므로 최우선.

## 9. 의사결정 이력

| # | 항목 | 결정 | 상태 |
|---|---|---|---|
| 1 | 페르소나 근거 데이터 | 공개 데이터 기반 (내부 데이터는 `evidence.type: internal` 슬롯만 예약) | 기본값 채택 |
| 2 | 반응 예측 방법론 | Fogg B=MAP 프레임워크 + LLM 구조화 추론 (에이전트 시뮬레이션 아님) | 기본값 채택 |
| 3 | 시장 범위 | KR 우선, `market` 필드로 글로벌 확장 가능 | 기본값 채택 |
| 4 | 보고서 방식 | 날짜별 스냅샷 HTML + 직전 회차 diff | 기본값 채택 |
| 5 | 플러그인 규격 | `src/` 루트, `src/.codex-plugin/plugin.json` 필수, SKILL.md 스킬 + Node 스크립트, MCP 미사용 | **사용자 확인 (2026-07-03)** |
| 6 | 데모 시나리오 | 백테스트 단독, 가상 외부 이벤트 미포함 | **사용자 확인 (2026-07-03)** |
| 7 | 내부 이벤트 `planned` 상태 | 허용 — 실행 전 사전 점검 시나리오 지원. 보고서 구분 배지, diff·백테스트에서 제외 | **사용자 확인 (2026-07-03)** |
| 8 | 온보딩 | 별도 `/setup` 스킬 — config.yaml·taxonomy 초안 생성, 타 스킬은 config 부재 시 setup 안내 | **사용자 확인 (2026-07-03)** |
| 9 | 주간 원커맨드 | `/brief` 제공 — 검토 큐에서만 일시정지, 승인 게이트(V6) 비자동화 | **사용자 확인 (2026-07-03)** |

스킬은 총 7개로 확정(§5.2). 입력 체계·시나리오 상세는 `docs/inputs-and-scenarios.md`.
