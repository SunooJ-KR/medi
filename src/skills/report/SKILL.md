---
name: report
description: Render a self-contained HTML report from a validated reaction run.
---

# Report

Render a single self-contained HTML report (inline CSS/SVG, no external requests)
into `reports/` from a simulation run. All aggregation, scoring, diffing, and chart
rendering are **code**; this skill orchestrates the scripts and reports the path.

## 1. Preconditions

- A simulation run must exist under `data/reactions/<run-id>/` with a `run.yaml`
  and at least one reaction. If not, run `/simulate` first.
- Run `node src/scripts/validate.mjs data/` and confirm `ok: true` before rendering.
  Never render an unvalidated run.

## 2. Render

- Basic: `node src/scripts/render.mjs --run <run-id>`
- With change tracking vs. the previous report:
  `node src/scripts/render.mjs --run <run-id> --prev reports/<YYYY-MM-DD>.json`

The script:
- writes `reports/YYYY-MM-DD.html` (self-contained) and a `reports/YYYY-MM-DD.json`
  snapshot used as the `--prev` baseline for the next report;
- appends a numeric suffix (`-2`, `-3`) when a report for the same date exists
  (idempotent re-runs);
- prints `{ path, snapshot, run_id, backtest }`.

To inspect the render model without writing files:
`node src/scripts/aggregate.mjs --run <run-id> [--prev <report.json>]`.

## 3. Report structure (produced automatically)

1. **요약** — KPIs, 3-line lede, 대응 우선순위 Top 3
   (`|Δmotivation + Δprompt| × confidence-weight`, summed over affected personas).
2. **시각화** — 페르소나×이벤트 히트맵, 이벤트 타임라인(내부/외부 색 구분), 고민별 기회-리스크 매트릭스 (inline SVG).
3. **상세** — 페르소나 카드(B=MAP + 근거), 이벤트 카드(출처 링크·tier 배지), 반응 상세.
4. **변화 추적** — `--prev` 대비 신규 이벤트·델타 변경 쌍·우선순위 변동.
5. **한계 고지** — 합성 페르소나·홍보성 기사·미승인 이벤트 수 고지.

## 4. Render rules (enforced by the renderer)

- `confidence: low` 반응은 흐리게(저채도·저대비) 렌더된다.
- `status: planned` 이벤트에는 `예정` 배지가 붙는다.
- 모든 외부 근거는 출처 링크로 노출된다.
- backtest run이면 상단 배너 + 상세에 추론 대 실제 비교 레이아웃으로 렌더된다.

## 5. Finish

Print the report path and a one-line Korean summary (대상 이벤트 수, 반응 쌍 수,
최우선 이벤트). Suggest opening the HTML file directly (no server needed).

## Prohibited

- Do not render a run that has not passed `validate.mjs`.
- Do not add any external CDN/script/stylesheet/font/remote-image reference to the
  generated HTML — it must open identically offline on any machine.
