---
name: simulate
description: Match reviewed events to personas and infer B=MAP customer reactions, saved as a validated run.
---

# Simulate

Infer how each confirmed persona reacts to each eligible event, using the Fogg
B=MAP model (motivation / ability / prompt). The **matching and run scaffold are
code** (`match.mjs`, `simulate.mjs`); the **reaction inference is your job** as
the LLM. Every reaction is saved as YAML under `data/reactions/<run-id>/` and must
pass `validate.mjs` before you finish.

## 1. Preconditions

Stop and route the user to the right skill if any of these are missing:
- `data/config.yaml`, `data/taxonomy.yaml` → run `/setup`.
- at least one confirmed persona in `data/personas/` → run `/persona-build`.
- at least one eligible event (a reviewed external event, or an internal event with
  status `planned`/`occurred` inside the lookback window) → run `/event-add` or `/event-scan`.

## 2. Build the run

Call the scaffold script. It runs matching, creates the run directory, and writes
`run.yaml` (the reproducibility record and the base for reports/diffs):

- Default (lookback from config): `node src/scripts/simulate.mjs`
- Since a date: `node src/scripts/simulate.mjs --since 2026-05-01`
- Single event: `node src/scripts/simulate.mjs --event <event_id>`
- Backtest: `node src/scripts/simulate.mjs --backtest <event_id>`

The script prints `{ run_id, run_dir, run_file, backtest, params, pairs, excluded }`.
- `pairs` are the (persona_id, event_id) targets you must infer, each annotated with
  `concerns_matched` and `channels_matched`.
- `excluded` lists events left out with reasons (V6 / lookback / no match) — surface
  these in the summary; never re-add an excluded event by hand.
- To inspect matching alone without creating a run: `node src/scripts/match.mjs [...]`.

## 3. Infer one reaction per pair

For each pair, read the full persona YAML and the full event YAML. Build the context
and produce **one reaction object matching `reaction.schema.json` exactly** — no extra
keys, no prose outside the YAML.

Context to hold for each pair:
- The persona card in full: `bmap_baseline` (motivation/ability/prompt) **and the
  `evidence` entries quoted verbatim**.
- The event: `summary`, `type`, `market`, `affected_concerns`, `affected_channels`,
  and (external) `sources`.
- The taxonomy entry for each matched concern (ingredients, representative products).

Inference rules:
- **Deltas are conservative.** Each of `motivation`, `ability`, `prompt` is an integer
  in −2..+2. Use ±2 **only** when the event clearly and directly moves that lever for
  this persona; when unsure, use 0. Do not spread the same delta across every pair.
- **`direction`**: `opportunity` if the net effect helps conversion, `risk` if it
  raises a barrier or aids a competitor, `neutral` if negligible.
- **`rationale` must reference the provided evidence** (persona evidence quote and/or
  event summary/source). Never introduce a fact that is not in the context.
- **`evidence_refs`** lists the actual references you used, e.g. `persona.evidence[0]`,
  `event.summary`, `event.sources[0]`, `taxonomy.pigmentation`.
- **`predicted_behaviors`** and **`suggested_actions`** must be specific to *this*
  persona × *this* event. Reject generic advice that would fit any pair.
- **`confidence` self-assessment:** `high` = persona evidence and the event connect
  directly; `medium` = indirect/inferred link; `low` = general reasoning only.

### Backtest mode (`--backtest`)
Put this constraint at the top of the context and obey it: **"Assume you know nothing
that happened after the event's `date_occurred`."** Do not use hindsight, later reviews,
or downstream outcomes as evidence. `run.yaml` records `backtest: true` so the report
renders an actual-vs-predicted view.

## 4. Save and validate

- Write each reaction to `data/reactions/<run-id>/rNN.yaml` (zero-padded index).
- Run `node src/scripts/validate.mjs data/` (or the run dir).
- If a reaction fails (delta out of range, missing field, unknown persona/event,
  V6 violation): **re-infer only that pair**, at most twice. If it still fails, drop
  the pair from the run and note it in the console summary — never save an invalid file
  and never edit a value purely to pass validation.

## 5. Console summary

After validation passes, print a short Korean summary:
- Top 3 risks and top 3 opportunities across the run, each with persona, event, and
  confidence.
- Pair count saved, and the excluded events with their reasons.
- Suggested next step: `/report` to render the run.

## 6. Prohibited

- Do not save any reaction that has not passed `validate.mjs`.
- Do not simulate an `unreviewed`/`rejected` external event through any path (V6),
  including `--event`/`--backtest`.
- Do not invent evidence or attributes not present in the persona/event/taxonomy context.
- Do not hand-edit `run.yaml`'s matching results to add or remove events.
