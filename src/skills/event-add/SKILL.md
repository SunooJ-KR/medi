---
name: event-add
description: Convert internal or external market events into validated event YAML files.
---

# Event Add

Use this skill to add, edit, confirm, and validate market events under `data/events/`.

## Workflow

1. Read `data/config.yaml`, `data/taxonomy.yaml`, and the current `data/events/` directory.
2. Convert the user's natural-language event into structured fields.
3. Before writing, show a concise Korean confirmation table with:
   - `id`
   - `kind`
   - `type`
   - `title`
   - `date_occurred`
   - `market`
   - `affected_concerns`
   - `affected_channels`
   - `sources`
   - `status`
4. Run dedupe before saving. The script returns duplicate candidates; the skill decides whether to stop, ask, or continue with `--force`.
5. Save only after the user confirms or the instruction clearly says to proceed.
6. Run validation before finishing.

## Commands

- Preview internal event:
  `node src/scripts/event-add.mjs --type campaign --title "<title>" --date YYYY-MM-DD --concerns concern_a,concern_b --channels own_mall --summary "<summary>"`
- Save internal event:
  `node src/scripts/event-add.mjs --write --type campaign --title "<title>" --date YYYY-MM-DD --concerns concern_a --summary "<summary>"`
- Save planned internal event:
  `node src/scripts/event-add.mjs --write --status planned --type promotion --title "<title>" --date YYYY-MM-DD --concerns concern_a --summary "<summary>"`
- Confirm planned internal event:
  `node src/scripts/event-add.mjs --confirm evt_YYYY_name --write --date YYYY-MM-DD --summary "<completion summary>"`
- Preview or save external event:
  `node src/scripts/event-add.mjs --external --type competitor_launch --title "<title>" --date YYYY-MM-DD --market JP --concerns concern_a --summary "<summary>" --source-url "<url>"`
- Edit an existing event:
  `node src/scripts/event-add.mjs --edit evt_YYYY_name --write --title "<new title>" --summary "<new summary>"`
- Check duplicates directly:
  `node src/scripts/dedupe.mjs --type campaign --date YYYY-MM-DD --title "<title>"`

## Rules

- Require `data/config.yaml` and `data/taxonomy.yaml`; if missing, stop and tell the user to run `/setup`.
- External events must include at least one source URL. Missing external sources must fail with rule `V5`.
- Internal event statuses are `planned` or `occurred`.
- External event statuses are `unreviewed`, `reviewed`, or `rejected`.
- Do not save an event with a type outside the schema enum.
- Keep written event summaries factual and brief.
- Finish by running `node src/scripts/validate.mjs data`.
