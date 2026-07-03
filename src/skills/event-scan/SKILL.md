---
name: event-scan
description: Scan public sources for external market events and queue them for review.
---

# Event Scan

Use this skill to discover external market events and place them in a review queue.

## Workflow

1. Read `data/config.yaml`, especially competitors, channels, markets, keywords, and lookback settings.
2. Search public sources when available. Prefer official sources, reputable press, commerce/platform pages, then community sources.
3. Save discovered external events with `status: unreviewed`.
4. Skip any candidate whose source URL already exists in `data/events/`.
5. Show a Korean review queue with index, id, title, market, date, and source URL.
6. Apply explicit user decisions:
   - approve -> `status: reviewed`
   - reject -> `status: rejected`
7. Run validation after writing or review status changes.

## Commands

- Preview configured scan candidates and current queue:
  `node src/scripts/event-scan.mjs`
- Save deterministic public-source seed candidates:
  `node src/scripts/event-scan.mjs --write`
- Approve queue items:
  `node src/scripts/event-scan.mjs --approve 1,evt_2025_qoo10_no1`
- Reject queue items:
  `node src/scripts/event-scan.mjs --reject 2`
- Approve and reject in one pass:
  `node src/scripts/event-scan.mjs --approve 1 --reject 2`

## Rules

- Require `data/config.yaml` and `data/taxonomy.yaml`; if missing, stop and tell the user to run `/setup`.
- Every saved external event must have at least one source URL.
- Do not let `unreviewed` events enter later simulation/matching steps.
- The current script provides a deterministic, repeatable public-source seed scan for local testing; live web research can add candidates through the same event schema.
- Finish by running `node src/scripts/validate.mjs data`.
