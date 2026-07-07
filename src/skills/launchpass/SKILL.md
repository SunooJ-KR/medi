# LaunchPass Skill

제품명과 타겟 국가를 입력받아 현지 시장 조사 → 표현 규제 검증 → 현지 페르소나별 카피 생성 → 런칭 레디니스 판정(HTML 보고서)까지 자동 수행한다.

**핵심 원칙**
- 특정 국가를 코드에 내장하지 않는다. 저장소에는 `rules/_schema.json`, `concerns/_schema.json`, `personas/_schema.json` 세 스키마만 존재하며, 국가별 데이터(`{국가코드}.json`)는 실행 시 부트스트랩으로 생성된다.
- 규제 위반 **판정은 코드**(`scripts/validate_copy.py`)가 하고, AI는 조사·카피 생성·대체안 제안만 한다.
- 부트스트랩 산출물은 **AI가 초안만** 만들고 **확정은 사람**이 한다.

## 트리거

- "{국가} 런칭 검증", "{국가} 진출 분석", "카피 규제 검사", "LaunchPass 실행"
- "{국가} 시장 추가", "{국가} 룰셋 만들어줘" (→ 부트스트랩 단독 실행)
- 국가 미지정 시 반드시 먼저 확인: **"어느 국가를 검증할까요?"**

---

## STAGE 0 — 국가 리졸브

1. 사용자 입력에서 국가명을 ISO 3166-1 alpha-2 **국가코드**로 변환한다.
   (일본 → JP, 미국 → US, EU → EU, 싱가포르 → SG …) 파일명에는 소문자를 쓴다: `jp`, `us`, `sg`.
2. 다음 세 파일의 존재 여부를 확인한다:
   - `concerns/{국가코드}.json`
   - `rules/{국가코드}.json`
   - `personas/{국가코드}.json`
3. 분기:
   - 셋 다 존재 → STAGE 1로 진행.
   - 하나라도 없음 → **부트스트랩 절차(아래 "부트스트랩")** 로 분기하여 누락분을 생성·승격한 뒤 STAGE 1로 진행.
4. 존재하는 파일은 각 스키마(`_schema.json`)를 만족하는지, `last_verified`가 90일을 초과하지 않는지 확인한다.
   90일 초과 시 보고서 헤더에 "⚠️ 데이터 기준일 경과"를 표시하도록 플래그를 세운다.

> STAGE 1~4의 상세 절차는 Phase 3(SKILL.md STAGE 1~4)에서 작성한다. 현재 문서는 STAGE 0과 부트스트랩까지 확정한다.

---

## 부트스트랩 — 새 국가 데이터 생성 (concerns → rules → personas)

트리거: STAGE 0에서 데이터 누락 감지, 또는 "{국가} 시장 추가" 직접 요청.

**생성 순서는 의존성을 반영한다: concerns → rules → personas.**
(personas는 concerns 격자에서 파생되므로 concerns가 먼저 있어야 한다.)

### 1. [고민 격자] `concerns/{국가코드}.draft.json`

- `web_search`로 해당 국가의 **나이대별 스킨케어 고민** 공개 조사 리포트를 수집한다.
- `concerns/_schema.json`에 맞춰 초안을 생성한다.
- **각 grid 셀에 `evidence`(공개 출처) 필수.** 근거를 못 찾은 셀은 만들지 않는다.
- `verified_by`는 `"ai"`로 둔다.

### 2. [규제] `rules/{국가코드}.draft.json`

- `web_search`로 해당 국가 **화장품 광고 규제 공식 문서**를 조사한다.
  (예: 일본 약기법, 미국 FDA 라벨링 + FTC 광고 가이드, EU 화장품 규정)
- `rules/_schema.json`에 맞춰 초안을 생성한다.
- **각 룰에 `source_urls`/`legal_basis` 명시.** 출처를 확정 못 한 룰은 `"unverified": true` 플래그를 세운다.
- `verified_by`는 `"ai"`로 둔다.

### 3. [페르소나] `personas/{국가코드}.draft.json`

- 1번 concerns 격자를 기반으로, **나이대 × 고민 셀에서 페르소나 초안을 파생**한다.
- `personas/_schema.json`에 맞춰 생성한다.
- **각 페르소나에 `age_band`·`linked_concerns`·`evidence` 필수.** 근거 없으면 생성하지 않는다.
- `derived_from`에 원천 concerns 파일·버전을 기록한다 (예: `concerns/jp.json v1.0.0`).
- `verified_by`는 `"ai"`로 둔다.

### 4. ⚠️ 사람 검토 및 승격

- 세 `.draft.json`을 사용자에게 제시하고 **승인을 받는다.**
- 승인된 파일만 `.draft`를 제거하여 정식 파일로 승격하고, `verified_by`를 `"human"`으로 바꾼다.
- 승인 전에는 STAGE 1 이후를 진행하지 않는다.

> 컴플라이언스·타겟팅 기준을 AI가 단독 확정하는 것은 법적·전략적 책임 관점에서 위험하다. "AI는 초안, 확정은 사람"은 의도된 설계다.

---

## 신선도 체크 · 업데이트 (규제·트렌드 변경 대응)

1. 매 실행 시 `validate_copy.py`가 각 데이터셋의 `last_verified`를 확인한다 → 90일 초과 시 보고서 헤더에 경고.
2. 사용자가 "업데이트" 요청 시 (rules/concerns 공통):
   - `source_urls`의 공식 문서를 재조회한다.
   - 현행 파일과 비교하여 **변경점 diff만** 생성한다 (신설/개정/폐지).
   - diff를 사람에게 제시 → 승인 시 버전 증가(1.0.0 → 1.1.0) + `last_verified` 갱신.
   - concerns가 갱신되면 파생된 personas도 재검토 대상으로 표시한다.
3. 모든 보고서에 "데이터 버전 · 기준일"을 명시하여 판정의 시효를 투명화한다.
