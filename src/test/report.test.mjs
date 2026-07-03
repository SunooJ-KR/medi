import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { aggregate } from "../scripts/aggregate.mjs";
import { render } from "../scripts/render.mjs";

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

// Build a minimal data/ tree with one run so aggregate/render have real inputs.
function makeWorkspace({ reactions, runMeta }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "report-test-"));
  write(path.join(root, "data", "taxonomy.yaml"), "concerns:\n  pigmentation:\n    label: 잡티\n    ingredients: []\n    representative_products: []\n");
  write(
    path.join(root, "data", "personas", "p01_a.yaml"),
    "id: p01_a\nname: A\nmarket: KR\nconcerns:\n  - pigmentation\nbmap_baseline:\n  motivation: m\n  ability: a\n  prompt: p\nevidence:\n  - source: s\n    quote: q\n    type: internal\nconfidence: high\n",
  );
  write(
    path.join(root, "data", "personas", "p02_b.yaml"),
    "id: p02_b\nname: B\nmarket: KR\nconcerns:\n  - pigmentation\nbmap_baseline:\n  motivation: m\n  ability: a\n  prompt: p\nevidence:\n  - source: s\n    quote: q\n    type: internal\nconfidence: low\n",
  );
  write(
    path.join(root, "data", "events", "internal", "evt_2026_x.yaml"),
    "id: evt_2026_x\nkind: internal\ntype: campaign\ntitle: Event X\ndate_occurred: '2026-06-01'\nmarket: KR\naffected_concerns:\n  - pigmentation\nsummary: sx\nstatus: occurred\n",
  );
  write(
    path.join(root, "data", "events", "internal", "evt_2026_y.yaml"),
    "id: evt_2026_y\nkind: internal\ntype: promotion\ntitle: Event Y\ndate_occurred: '2026-06-15'\nmarket: KR\naffected_concerns:\n  - pigmentation\nsummary: sy\nstatus: planned\n",
  );
  const runDir = path.join(root, "data", "reactions", "run_test");
  write(path.join(runDir, "run.yaml"), runMeta);
  reactions.forEach((r, i) => write(path.join(runDir, `r0${i + 1}.yaml`), r));
  return root;
}

const runMeta = "run_id: run_test\nbacktest: false\nparams: {}\ntarget_events:\n  - evt_2026_x\n  - evt_2026_y\npair_count: 3\nexcluded: []\n";

function reaction({ persona, event, m, a, p, dir, conf }) {
  return `persona_id: ${persona}\nevent_id: ${event}\ndeltas: { motivation: ${m}, ability: ${a}, prompt: ${p} }\ndirection: ${dir}\npredicted_behaviors:\n  - b\nsuggested_actions:\n  - act\nconfidence: ${conf}\nrationale: r\nevidence_refs:\n  - persona.evidence[0]\n`;
}

test("priority formula: sum of |Δm+Δp| × confidence weight per event, ranked", () => {
  const root = makeWorkspace({
    runMeta,
    reactions: [
      reaction({ persona: "p01_a", event: "evt_2026_x", m: 2, a: 0, p: 1, dir: "opportunity", conf: "high" }), // |3|*1.0=3.0
      reaction({ persona: "p02_b", event: "evt_2026_x", m: 1, a: 0, p: 0, dir: "risk", conf: "low" }), //         |1|*0.3=0.3
      reaction({ persona: "p01_a", event: "evt_2026_y", m: 1, a: 0, p: 1, dir: "opportunity", conf: "medium" }), //|2|*0.6=1.2
    ],
  });
  const out = aggregate({ cwd: root, run: "run_test" });
  const x = out.events.find((e) => e.id === "evt_2026_x");
  const y = out.events.find((e) => e.id === "evt_2026_y");
  assert.equal(x.priority, 3.3, "event X priority = 3.0 + 0.3");
  assert.equal(y.priority, 1.2, "event Y priority = 1.2");
  assert.equal(x.rank, 1, "higher priority ranks first");
  assert.equal(y.rank, 2);
});

test("diff detects new events, changed deltas, and priority shifts vs previous snapshot", () => {
  const root = makeWorkspace({
    runMeta,
    reactions: [
      reaction({ persona: "p01_a", event: "evt_2026_x", m: 2, a: 0, p: 1, dir: "opportunity", conf: "high" }),
      reaction({ persona: "p01_a", event: "evt_2026_y", m: 1, a: 0, p: 1, dir: "opportunity", conf: "medium" }),
    ],
  });
  // Previous snapshot: only event X existed, with a different delta sum for the pair.
  const prevPath = path.join(root, "prev.json");
  fs.writeFileSync(
    prevPath,
    JSON.stringify({
      run_id: "run_prev",
      events: [{ id: "evt_2026_x", rank: 1, priority: 1.0 }],
      reactions: [{ persona_id: "p01_a", event_id: "evt_2026_x", sum_mp: 1 }],
    }),
  );
  const out = aggregate({ cwd: root, run: "run_test", prev: prevPath });
  assert.ok(out.diff.has_prev);
  assert.deepEqual(out.diff.new_events, ["evt_2026_y"]);
  assert.ok(out.diff.changed_pairs.some((c) => c.event_id === "evt_2026_x" && c.from === 1 && c.to === 3));
  assert.ok(out.diff.priority_changes.some((c) => c.event_id === "evt_2026_x"));
});

test("render writes self-contained HTML: five section anchors and no network-loading references", () => {
  const root = makeWorkspace({
    runMeta,
    reactions: [reaction({ persona: "p01_a", event: "evt_2026_x", m: 1, a: 1, p: 1, dir: "opportunity", conf: "high" })],
  });
  const result = render({ cwd: root, run: "run_test", date: "2026-07-03" });
  assert.ok(result.ok);
  const html = fs.readFileSync(path.join(root, result.path), "utf8");
  for (const id of ["summary", "visualizations", "details", "changes", "limitations"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing section #${id}`);
  }
  // No resource that would trigger a network fetch on load.
  assert.doesNotMatch(html, /<script[^>]+src=/i, "no external script");
  assert.doesNotMatch(html, /<link[^>]+href=/i, "no external stylesheet");
  assert.doesNotMatch(html, /@import/i, "no CSS @import");
  assert.doesNotMatch(html, /url\(\s*https?:/i, "no remote url() asset");
});

test("render is idempotent per date via numeric suffix", () => {
  const root = makeWorkspace({
    runMeta,
    reactions: [reaction({ persona: "p01_a", event: "evt_2026_x", m: 1, a: 1, p: 1, dir: "opportunity", conf: "high" })],
  });
  const first = render({ cwd: root, run: "run_test", date: "2026-07-03" });
  const second = render({ cwd: root, run: "run_test", date: "2026-07-03" });
  assert.equal(first.path, "reports/2026-07-03.html");
  assert.equal(second.path, "reports/2026-07-03-2.html");
});
