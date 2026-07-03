import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runBrief } from "../scripts/brief.mjs";

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brief-test-"));
  write(path.join(root, "data", "config.yaml"), "company:\n  name: Test\n  official_urls:\n    - https://example.com\nmarkets:\n  - KR\ndefault_market: KR\nchannels:\n  - own_mall\ndefault_channels:\n  - own_mall\ncompetitors:\n  - name: Competitor\n    keywords:\n      - competitor skincare\nscan:\n  lookback_weeks: 8\n  extra_keywords:\n    - test\n  source_whitelist:\n    - example.com\n");
  write(path.join(root, "data", "taxonomy.yaml"), "concerns:\n  pigmentation:\n    label: Pigmentation\n    ingredients: []\n    representative_products: []\n");
  write(path.join(root, "data", "personas", "p01_test.yaml"), "id: p01_test\nname: Persona\nstatus: confirmed\nmarket: KR\nconcerns:\n  - pigmentation\ndemographics:\n  age_band: 30s\n  price_band: mid\nchannels:\n  - own_mall\nbmap_baseline:\n  motivation: m\n  ability: a\n  prompt: p\nevidence:\n  - source: s\n    quote: q\n    type: internal\nconfidence: high\n");
  write(path.join(root, "data", "events", "external", "evt_2026_unreviewed.yaml"), "id: evt_2026_unreviewed\nkind: external\ntype: competitor_launch\ntitle: Unreviewed event\ndate_occurred: '2026-06-01'\ndate_collected: '2026-07-03'\nmarket: KR\naffected_concerns:\n  - pigmentation\nsummary: s\nsources:\n  - url: https://example.com/event\n    tier: press\n    title: Source\nstatus: unreviewed\n");
  return root;
}

test("brief stops at review queue and does not render a report", () => {
  const root = makeWorkspace();
  const result = runBrief({ cwd: root, now: "2026-07-03", date: "2026-07-03" });
  assert.equal(result.ok, true);
  assert.equal(result.stage, "review_required");
  assert.equal(result.report, null);
  assert.ok(result.scan.review_queue.some((item) => item.id === "evt_2026_unreviewed"));
  assert.equal(fs.existsSync(path.join(root, "reports")), false);
});
