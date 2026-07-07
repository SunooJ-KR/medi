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

## 입력

| 항목 | 필수 | 설명 |
|------|------|------|
| `product_name` | ✅ | 제품명 (보고서 제목·파일명에 사용) |
| `product_desc` | ✅ | 제품 설명 — 성분·효능. STAGE 3 페르소나 매칭과 카피 생성의 근거 |
| `target_country` | ✅ | 타겟 국가. 없으면 트리거 단계에서 되묻는다 |
| `ko_copy` | ⬜ | 한국어 마케팅 카피. 있으면 STAGE 2에서 그대로 검증, 없으면 제품 설명에서 예상 카피를 추출 |

파이프라인은 STAGE 0 → 1 → 2 → 3 → 4 순서로 진행하며, 각 스테이지 산출물은 STAGE 4 보고서의 섹션으로 매핑된다.

---

## STAGE 0 — 국가 리졸브

1. 사용자 입력에서 국가명을 ISO 3166-1 alpha-2 **국가코드**로 변환한다.
   (일본 → JP, 미국 → US, EU → EU, 싱가포르 → SG …) 파일명에는 소문자를 쓴다: `jp`, `us`, `sg`.
   - 국가가 모호하거나 미지정이면 진행하지 말고 사용자에게 되묻는다.
2. 다음 세 파일의 존재 여부를 확인한다:
   - `concerns/{국가코드}.json`
   - `rules/{국가코드}.json`
   - `personas/{국가코드}.json`
3. 분기:
   - 셋 다 존재 → STAGE 1로 진행.
   - 하나라도 없음 → **부트스트랩 절차(아래 "부트스트랩")** 로 분기한다. 부트스트랩은
     **사람 승인**을 거쳐 정식 파일로 승격된 뒤에야 STAGE 1로 진행한다. 승인 전 중단.
4. 존재하는 파일은 각 스키마(`_schema.json`)를 만족하는지 확인한다.
   신선도(`last_verified` 90일)는 STAGE 2의 `validate_copy.py`가 판정하여 결과 JSON의
   `freshness`로 반환하므로, 그 플래그를 STAGE 4 보고서 헤더 경고로 옮긴다.
5. 리졸브 결과(국가코드, 3개 파일 경로, 데이터 버전)를 이후 스테이지가 참조하도록 확정한다.

---

## STAGE 1 — 시장 스캔 (web_search)

목적: 타겟 국가의 현지 시장 맥락을 수집해 보고서 Section 2(시장 스캔)와 STAGE 3 카피 톤 결정의 배경으로 쓴다.

**절차는 국가 무관하게 고정하고, 쿼리의 지역·언어만 국가코드에 맞춰 치환한다.**

1. `web_search`로 다음을 조사한다 (`{카테고리}`=제품 카테고리, `{국가}`=현지어 국가명, `{현재년월}`=오늘 기준):
   - `"{카테고리} {국가} 트렌드 {현재년월}"` — 현지 스킨케어 트렌드·인기 성분
   - `"{카테고리} {국가} 경쟁 제품 가격"` — 유사 카테고리 경쟁 제품·가격대
   - `"{국가} 소비자 피부 고민 우선순위"` — 현지 소비자 고민(concerns 격자 교차 확인용)
2. 각 쿼리는 현지어로도 1회 병행 검색해 현지 소스를 확보한다 (예: 일본이면 일본어 쿼리 병행).
3. 결과를 아래 `market_scan` 요약 형식으로 정리한다. **출처 URL을 반드시 병기**한다.

```
market_scan:
  trend_keywords: [현지 트렌드 키워드 3~5개]
  competitors:
    - {제품명}: {가격대} / {핵심 소구점} / {출처}
  consumer_concerns: [현지 소비자 고민 상위 항목]  # concerns 격자와 대조
  sources: [조사에 사용한 공개 URL 목록]
```

4. 이 요약은 STAGE 3에서 concerns 격자의 top_concerns와 대조해 페르소나 매칭의 참고 신호로 쓴다
   (판정 근거가 아니라 배경 맥락 — 규제 판정은 STAGE 2 코드가 전담).

---

## STAGE 2 — 규제 검증 (필수 코드 실행)

목적: 카피의 규제 위반을 **코드**로 판정한다. 이 판정은 AI 환각이 개입해선 안 되는 지점이다.

1. 검증 대상 카피를 정한다: 사용자의 `ko_copy`가 있으면 그대로, 없으면 `product_desc`에서 예상 카피를 추출한다.
2. 검증 스크립트를 실행한다:

   ```
   python scripts/validate_copy.py --input "{카피}" --rules rules/{국가코드}.json
   ```
   - 여러 문장·여러 카피는 각각 실행하거나 줄바꿈으로 합쳐 한 번에 넘긴다.
   - 결과 JSON의 `freshness.stale`이 true면 STAGE 4 보고서 헤더에 데이터 기준일 경과 경고를 표시한다.
3. 결과 JSON을 파싱해 `verdict` / `violations[]`(rule_id·matched·severity·alternatives) / `pass_rate`를 정리한다.

> ⚠️ **이 단계는 반드시 스크립트를 실행한다. AI 자체 판단으로 위반 여부를 대체하지 않는다.**
> ⚠️ **룰셋(rules/{국가코드}.json) 본문을 컨텍스트로 읽지 않는다.** 검증은 스크립트에 위임하고
> 반환된 결과(위반 항목)만 사용한다 — 룰이 수백 개여도 토큰이 컨텍스트에 진입하지 않게 한다.

산출물: `validation` 결과 JSON. STAGE 3의 자가 검증 루프와 STAGE 4의 Section 3(규제 검증 결과)에 사용된다.

---

## STAGE 3 — 고민→페르소나→카피 파생 + 자가 검증 루프

목적: 제품에 맞는 페르소나를 concerns 격자에서 파생하고, 페르소나별 현지어 카피를 생성하되
**생성한 카피가 STAGE 2 검증을 100% 통과할 때까지 코드가 보증**한다 (생성=AI, 검증=코드).

1. `concerns/{국가코드}.json`을 로드한다 (STAGE 0에서 없으면 이미 부트스트랩됨).
2. **셀 매칭**: `product_desc`의 효능·성분과 격자의 `top_concerns`를 대조해, 제품이 소구하는
   (나이대 × 고민) 셀을 고른다. STAGE 1의 `consumer_concerns`를 참고 신호로 함께 본다.
3. **페르소나 파생**: 매칭된 셀에서 `personas/{국가코드}.json`의 페르소나를 선택/파생한다.
   - **페르소나 개수를 코드나 절차에 고정하지 않는다.** 매칭된 셀 수만큼 동적으로 정해진다.
   - 각 페르소나는 `age_band`·`linked_concerns`·`copy_direction`을 갖는다 (파생 근거 추적).
4. **카피 생성**: 각 페르소나의 `copy_direction`을 입력으로 현지어 카피를 생성한다.
   - 해당 나이대·고민에 소구하고, STAGE 2에서 드러난 NG 표현을 회피한다.
5. **자가 검증 루프**: 생성한 카피 전건을 STAGE 2 스크립트에 재투입한다:

   ```
   python scripts/validate_copy.py --input "{생성 카피}" --rules rules/{국가코드}.json
   ```
   - `verdict`가 `VIOLATION`이면 해당 카피를 `alternatives`를 참고해 **재생성**한다.
   - 재생성→재검증을 **최대 3회** 반복한다.
   - 3회 후에도 VIOLATION이 남으면 그 카피를 "미해결"로 표시하고 STAGE 4 판정을 🔴로 강등한다.
6. **전 카피가 PASS**(또는 WARNING만)일 때 각 페르소나에 승인 카피를 확정하고 STAGE 4로 넘어간다.

산출물: 페르소나별 `{승인 카피, 파생 근거(어느 셀), 검증 결과 배지, 추천 채널}`. STAGE 4 Section 4에 매핑.

> 이 자가 루프가 핵심 AI 활용 구조다: **생성(AI) → 검증(코드) → 재생성(AI)**.
> AI 출력의 규제 적합성을 AI가 아닌 코드(룰셋)가 보증한다.

---

## STAGE 4 — 레디니스 리포트 생성 (HTML)

목적: STAGE 1~3 산출물을 신호등 판정이 포함된 HTML 보고서로 출력한다.

1. **신호등 판정 로직** (STAGE 2·3의 검증 결과 종합):
   - 미해결 `VIOLATION`이 하나라도 있으면 → 🔴 **NOT READY**
   - VIOLATION은 없고 `WARNING`만 있으면 → 🟡 **CONDITIONAL**
   - 전체 카피가 PASS면 → 🟢 **READY**
2. `templates/readiness_report.html`을 기반으로 다음 섹션을 채운다:
   - 헤더: 제품명 · 타겟 시장 · 분석일시 · 신호등 판정(대형) · 데이터 버전·기준일 · (stale 시)⚠️ 경고
   - Section 1 요약: 판정 근거 3줄 + 즉시 조치/조건부 항목 수
   - Section 2 시장 스캔: 트렌드·경쟁 제품표 + concerns 격자 + 이 제품이 매칭된 셀 하이라이트
   - Section 3 규제 검증(★): 원본 카피 vs 위반 하이라이트 + 위반 룰 ID·근거·심각도·대체표현 표 + 통과율 게이지
   - Section 4 페르소나별 승인 카피: 파생 페르소나 카드(N개) + 검증 PASS 배지 + 파생 근거(어느 셀) + 추천 채널
   - Section 5 액션 아이템: 🔴 필수 / 🟡 권장 + 참고 공개 자료 링크
3. **저장**: `launchpass_report_{제품명}_{YYYY-MM-DD}.html`

산출물: 완성된 HTML 보고서 파일 1건.

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

### 신선도 체크 (매 실행, 자동)

- STAGE 2에서 `validate_copy.py`가 룰셋 `last_verified`를 확인해 결과 JSON의 `freshness`
  (`stale`, `days_since`, `warning`)로 반환한다. `stale`이 true면 STAGE 4 보고서 헤더에 그
  `warning` 문구를 표시한다. 임계값은 90일(`FRESHNESS_THRESHOLD_DAYS`).
- concerns·personas도 각 파일의 `last_verified`를 같은 기준으로 확인해, 경과 시 헤더에 함께 경고한다.

### 업데이트 (사용자가 "업데이트" 요청 시)

rules·concerns 공통 절차:

1. 해당 파일 `source_urls`의 공식 문서를 `web_fetch`로 재조회한다.
2. 현행 파일과 비교하여 **변경점 diff만** 생성한다 (신설/개정/폐지). 전체 재생성하지 않는다 — 토큰 절감.
3. diff를 사람에게 제시하고 승인을 받는다.
4. 승인 시: 버전 증가(예: 1.0.0 → 1.1.0) + `last_verified`를 오늘로 갱신 + `verified_by: "human"` 유지.
5. **concerns가 갱신되면**, 그 격자에서 파생된 `personas/{국가코드}.json`의 `derived_from` 버전이
   구버전을 가리키게 되므로 해당 personas를 **재검토 대상으로 표시**하고, 필요 시 재파생한다.

모든 보고서에 "데이터 버전 · 기준일"을 명시하여 판정의 시효를 투명화한다.
