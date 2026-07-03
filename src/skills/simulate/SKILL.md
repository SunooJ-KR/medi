---
name: simulate
description: Match reviewed events to personas and produce B=MAP reaction outputs.
---

# Simulate

Use this skill to generate customer reaction YAML files under `data/reactions/<run-id>/`.

Rules:
- Require config, taxonomy, at least one confirmed persona, and at least one reviewed or eligible internal event.
- Exclude external events unless `status: reviewed`.
- Match only relevant persona/event pairs by concern, market, and channel.
- Output only reaction-schema-compatible JSON/YAML for each pair.
- Run `node src/scripts/validate.mjs data/` before finishing.
- Never invent evidence; use `evidence_refs` that point to persona evidence or event sources.
