---
name: brief
description: Run the weekly scan, review, simulation, and report workflow.
---

# Brief

Use this skill as the weekly one-command workflow.

Rules:
- Run scan, stop at the review queue, then proceed only after user approval.
- Do not bypass the reviewed-event gate.
- If no new events are found, ask whether to simulate with existing reviewed events.
- Run validation at each write boundary.
- End with the generated report path and concise Korean summary.

Script:
- Preview/gate: `node src/scripts/brief.mjs`
- Approve/reject queued items and continue: `node src/scripts/brief.mjs --approve <index-or-id>` or `--reject <index-or-id>`
- Render an existing run after review: `node src/scripts/brief.mjs --run <run-id>`
- Backtest path: `node src/scripts/brief.mjs --backtest <event-id>`; if it returns `reaction_required`, create validated reaction YAML files, then rerun with `--run <run-id>`.
