# Demo Script

작성일: 2026-07-03
기준 브랜치: `main`
기준 데이터: `data/`의 검수된 페르소나 6개, 외부 백테스트 이벤트, 내부 이벤트 샘플

이 문서는 `docs/dev-process.md` Phase 5의 데모 리허설용 스크립트다. 심사 또는 공유 데모에서는 Codex 스킬 명령(`/brief`, `/simulate`, `/report`)을 보여 주되, 로컬 재현은 아래 npm/Node 명령으로 검증한다.

## 사전 점검

```powershell
cd C:\Users\sunoo\Documents\ax\medi\src
npm install
npm test
node scripts/validate.mjs fixtures/valid
node scripts/validate.mjs ..\data
```

예상 결과:
- `npm test`: 10개 테스트 통과
- 두 validate 명령: `{ "ok": true, "errors": [] }`

## S0 축약: 준비된 데이터 설명

보여 줄 파일:
- `docs/research.md`: 공개 자료 기반 회사/시장 조사
- `data/personas/`: 확정 페르소나 6개
- `data/events/external/evt_2025_amazon_mwf.yaml`: 검수된 백테스트 이벤트
- `data/events/external/evt_2025_shopee_77_growth.yaml`: 검토 큐 승인 예시
- `data/reactions/run_2026_07_03/`: 백테스트용 반응 run

핵심 설명:
- 자동 수집 외부 이벤트는 `status: reviewed`가 되어야만 시뮬레이션에 들어간다.
- `/brief`도 V6 검토 게이트를 우회하지 않는다.

## S4 백테스트: 신뢰도 검증

데모 핵심 경로다. 기존 반응 run을 사용해 바로 보고서를 렌더링한다.

```powershell
cd C:\Users\sunoo\Documents\ax\medi\src
npm run brief -- --run run_2026_07_03 --now 2026-07-03 --date 2026-07-03
```

예상 출력:
- `stage: "complete"`
- `report.path`: `reports/2026-07-03-2.html` 또는 같은 날짜의 숫자 suffix 파일
- `backtest: true`

보고서에서 확인할 장면:
- 상단 백테스트 배너
- `summary`, `visualizations`, `details`, `changes`, `limitations` 5개 섹션
- 상세 섹션의 "실제 관찰(백테스트)" 비교 칼럼

## S1 주간 브리핑: 검토 게이트와 diff

검토 큐가 남아 있을 때의 안전 정지:

```powershell
npm run brief -- --now 2026-07-03 --date 2026-07-03
```

예상 출력:
- 검토 큐가 있으면 `stage: "review_required"`에서 중단
- `report: null`
- 시뮬레이션과 보고서 생성은 실행되지 않음

검토 큐 승인 후 기존 run 렌더:

```powershell
npm run brief -- --approve 1 --run run_2026_07_03 --now 2026-07-03 --date 2026-07-03
```

예상 출력:
- `scan.review_queue: []`
- `stage: "complete"`
- `reports/`에 HTML과 JSON snapshot 생성

## S2 실행 전 사전 점검

planned 내부 이벤트를 미리 넣고 단일 이벤트 기준으로 영향을 본다.

```powershell
node scripts/event-add.mjs --write --status planned --type promotion --title "Retinal serum renewal launch plan" --date 2026-08-01 --market KR --concerns pigmentation,sensitive_soothing --channels own_mall --summary "Planned renewal launch for pre-flight risk check."
node scripts/match.mjs --event <created_event_id> --now 2026-07-03
node scripts/event-add.mjs --edit <created_event_id> --write --summary "Updated plan after pre-flight review."
node scripts/event-add.mjs --confirm <created_event_id> --write --date 2026-08-01 --summary "Promotion occurred with final launch scope."
```

판정 기준:
- planned 상태에서는 보고서에 사전 점검 배지가 표시되어야 한다.
- confirm 이후 상태가 `occurred`로 바뀌고 validate가 통과해야 한다.

## S3 긴급 대응

출처 누락은 V5로 거부된다.

```powershell
node scripts/event-add.mjs --external --type competitor_launch --title "Competitor launch signal" --date 2026-07-03 --market KR --concerns pigmentation --summary "Competitor launch found in press."
```

예상 출력:
- `ok: false`
- `errors[].rule: "V5"`

출처를 제공하면 preview 또는 write가 가능하다.

```powershell
node scripts/event-add.mjs --external --type competitor_launch --title "Competitor launch signal" --date 2026-07-03 --market KR --concerns pigmentation --summary "Competitor launch found in press." --source-url "https://example.com/news"
```

## 태그 절차

`demo-baseline` 태그는 working tree 변경을 커밋한 뒤 생성한다. 태그는 커밋만 가리키므로, 커밋 전에는 현재 산출물이 포함되지 않는다.

```powershell
git status --short
git add <demo files>
git commit -m "Prepare demo baseline"
git tag demo-baseline
```
