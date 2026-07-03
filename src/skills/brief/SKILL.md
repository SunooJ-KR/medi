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
