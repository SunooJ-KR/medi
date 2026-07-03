import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMatch } from "../scripts/match.mjs";

// Build an isolated data/ tree so tests never touch the repo's real data.
function makeWorkspace(personas, events) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "match-test-"));
  fs.mkdirSync(path.join(root, "data", "personas"), { recursive: true });
  fs.mkdirSync(path.join(root, "data", "events", "internal"), { recursive: true });
  fs.mkdirSync(path.join(root, "data", "events", "external"), { recursive: true });
  for (const persona of personas) {
    fs.writeFileSync(
      path.join(root, "data", "personas", `${persona.id}.yaml`),
      toYaml(persona),
    );
  }
  for (const event of events) {
    const sub = event.kind === "external" ? "external" : "internal";
    fs.writeFileSync(path.join(root, "data", "events", sub, `${event.id}.yaml`), toYaml(event));
  }
  return root;
}

// Minimal YAML emitter for flat objects + string arrays used in these fixtures.
function toYaml(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${item}`);
    } else if (value && typeof value === "object") {
      lines.push(`${key}:`);
      for (const [k, v] of Object.entries(value)) lines.push(`  ${k}: ${v}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join("\n") + "\n";
}

const persona = (over = {}) => ({
  id: "p01_test_persona",
  name: "Test",
  status: "confirmed",
  market: "KR",
  concerns: ["pigmentation"],
  channels: ["own_mall"],
  ...over,
});

const event = (over = {}) => ({
  id: "evt_2026_test_event",
  kind: "internal",
  type: "campaign",
  title: "t",
  date_occurred: "2026-06-01",
  market: "KR",
  affected_concerns: ["pigmentation"],
  summary: "s",
  status: "occurred",
  ...over,
});

const NOW = "2026-07-03"; // cutoff at 8 weeks = 2026-05-08

test("lookback boundary: event on the cutoff date is included, one day earlier is excluded", () => {
  const root = makeWorkspace(
    [persona()],
    [
      event({ id: "evt_2026_on_cutoff", date_occurred: "2026-05-08" }),
      event({ id: "evt_2026_before_cutoff", date_occurred: "2026-05-07" }),
    ],
  );
  const result = runMatch({ cwd: root, now: NOW, lookbackWeeks: 8 });
  const paired = result.pairs.map((p) => p.event_id);
  assert.ok(paired.includes("evt_2026_on_cutoff"), "cutoff-day event should pair");
  assert.ok(!paired.includes("evt_2026_before_cutoff"), "day-before-cutoff event should not pair");
  assert.ok(
    result.excluded.some((e) => e.event_id === "evt_2026_before_cutoff" && /lookback/.test(e.reason)),
  );
});

test("V6: unreviewed external events are excluded, reviewed are included", () => {
  const root = makeWorkspace(
    [persona()],
    [
      event({ id: "evt_2026_unreviewed", kind: "external", type: "competitor_launch", status: "unreviewed" }),
      event({ id: "evt_2026_reviewed", kind: "external", type: "competitor_launch", status: "reviewed" }),
    ],
  );
  const result = runMatch({ cwd: root, now: NOW, lookbackWeeks: 8 });
  const paired = result.pairs.map((p) => p.event_id);
  assert.ok(paired.includes("evt_2026_reviewed"));
  assert.ok(!paired.includes("evt_2026_unreviewed"));
  assert.ok(
    result.excluded.some((e) => e.event_id === "evt_2026_unreviewed" && /V6/.test(e.reason)),
  );
});

test("active_until extension keeps an out-of-window event in scope", () => {
  const root = makeWorkspace(
    [persona()],
    [event({ id: "evt_2026_extended", date_occurred: "2026-01-01", active_until: "2026-06-01" })],
  );
  const result = runMatch({ cwd: root, now: NOW, lookbackWeeks: 8 });
  assert.ok(result.pairs.some((p) => p.event_id === "evt_2026_extended"));
});

test("--event selects a single event and bypasses the window but not V6", () => {
  const events = [
    event({ id: "evt_2026_old_internal", date_occurred: "2025-01-01" }),
    event({ id: "evt_2026_other", date_occurred: "2026-06-01" }),
  ];
  const root = makeWorkspace([persona()], events);
  const result = runMatch({ cwd: root, now: NOW, lookbackWeeks: 8, event: "evt_2026_old_internal" });
  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0].event_id, "evt_2026_old_internal");

  // A single external pick that is unreviewed is still blocked by V6.
  const root2 = makeWorkspace(
    [persona()],
    [event({ id: "evt_2026_ext", kind: "external", type: "competitor_launch", status: "unreviewed" })],
  );
  const blocked = runMatch({ cwd: root2, now: NOW, lookbackWeeks: 8, event: "evt_2026_ext" });
  assert.equal(blocked.pairs.length, 0);
  assert.ok(blocked.excluded.some((e) => /V6/.test(e.reason)));
});

test("pairing requires market match and concern intersection; channel filter applies only when event lists channels", () => {
  const root = makeWorkspace(
    [
      persona({ id: "p01_kr", market: "KR", concerns: ["pigmentation"], channels: ["own_mall"] }),
      persona({ id: "p02_us", market: "US", concerns: ["pigmentation"], channels: ["amazon"] }),
      persona({ id: "p03_kr_wrongchannel", market: "KR", concerns: ["pigmentation"], channels: ["sikor"] }),
    ],
    [event({ id: "evt_2026_kr_channel", affected_channels: ["own_mall"] })],
  );
  const result = runMatch({ cwd: root, now: NOW, lookbackWeeks: 8 });
  const paired = result.pairs.map((p) => p.persona_id).sort();
  assert.deepEqual(paired, ["p01_kr"]);
});
