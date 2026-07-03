#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import yaml from "js-yaml";

const CONFIDENCE_WEIGHT = { high: 1.0, medium: 0.6, low: 0.3 };

function defaultRuntimeCwd() {
  const cwd = path.resolve(process.cwd());
  return path.basename(cwd) === "src" ? path.dirname(cwd) : cwd;
}

function parseArgs(argv) {
  const args = { cwd: defaultRuntimeCwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") args.cwd = path.resolve(argv[++i]);
    else if (arg === "--run") args.run = argv[++i];
    else if (arg === "--prev") args.prev = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      console.log(JSON.stringify({ ok: true, usage: "node src/scripts/aggregate.mjs --run <run-id> [--prev <report.json|report.html>] [--cwd <path>]" }, null, 2));
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, "utf8"), { schema: yaml.JSON_SCHEMA });
}

function walkYaml(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walkYaml(full));
    else if (/\.ya?ml$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function loadDir(dir) {
  const out = [];
  for (const file of walkYaml(dir)) {
    try {
      const data = readYaml(file);
      if (data && typeof data === "object") out.push(data);
    } catch {
      // validate.mjs is the authority on parse health.
    }
  }
  return out;
}

// Accept a previous report's .json sidecar, or a .html whose sibling .json holds the snapshot.
function loadPrev(prevPath) {
  if (!prevPath) return null;
  let jsonPath = prevPath;
  if (/\.html?$/i.test(prevPath)) jsonPath = prevPath.replace(/\.html?$/i, ".json");
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch {
    return null;
  }
}

function confWeight(confidence) {
  return CONFIDENCE_WEIGHT[confidence] ?? 0.3;
}

// Priority per event (plan.md §6-1): sum over its reactions of
// |Δmotivation + Δprompt| × confidence-weight. Summation carries the
// "× affected-persona count" term (more matched personas → larger sum).
function eventPriority(reactions) {
  return reactions.reduce((total, r) => {
    const magnitude = Math.abs((r.deltas.motivation || 0) + (r.deltas.prompt || 0));
    return total + magnitude * confWeight(r.confidence);
  }, 0);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function aggregate(args) {
  const dataDir = path.join(args.cwd, "data");
  const runDir = path.join(dataDir, "reactions", args.run);
  const runFile = path.join(runDir, "run.yaml");
  if (!fs.existsSync(runFile)) {
    return { ok: false, error: `run not found: ${path.relative(args.cwd, runFile)}` };
  }

  const runMeta = readYaml(runFile);
  const reactions = loadDir(runDir).filter((r) => r.persona_id && r.event_id);
  const personaById = new Map(loadDir(path.join(dataDir, "personas")).map((p) => [p.id, p]));
  const eventById = new Map(loadDir(path.join(dataDir, "events")).map((e) => [e.id, e]));
  let taxonomy = {};
  try {
    taxonomy = readYaml(path.join(dataDir, "taxonomy.yaml"))?.concerns || {};
  } catch {
    taxonomy = {};
  }

  // Events referenced by this run, scored and ranked by priority.
  const eventIds = [...new Set(reactions.map((r) => r.event_id))];
  const events = eventIds
    .map((id) => {
      const event = eventById.get(id) || { id };
      const eventReactions = reactions.filter((r) => r.event_id === id);
      return { ...event, priority: round2(eventPriority(eventReactions)) };
    })
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  events.forEach((event, index) => {
    event.rank = index + 1;
  });

  const personaIds = [...new Set(reactions.map((r) => r.persona_id))];
  const personas = personaIds
    .map((id) => personaById.get(id) || { id })
    .sort((a, b) => a.id.localeCompare(b.id));

  const enrichedReactions = reactions.map((r) => ({
    ...r,
    sum_mp: (r.deltas.motivation || 0) + (r.deltas.prompt || 0),
  }));

  // Heatmap: persona × event, cell = Δmotivation + Δprompt (signed), colored by direction.
  const heatmap = {
    personas: personas.map((p) => p.id),
    events: events.map((e) => e.id),
    cells: enrichedReactions.map((r) => ({
      persona_id: r.persona_id,
      event_id: r.event_id,
      value: r.sum_mp,
      direction: r.direction,
      confidence: r.confidence,
    })),
  };

  const timeline = events
    .map((e) => ({ id: e.id, title: e.title, date_occurred: e.date_occurred, kind: e.kind, type: e.type, status: e.status }))
    .sort((a, b) => String(a.date_occurred).localeCompare(String(b.date_occurred)));

  // Concern opportunity/risk matrix across all reactions.
  const concernAgg = new Map();
  for (const r of enrichedReactions) {
    const event = eventById.get(r.event_id);
    for (const concern of event?.affected_concerns || []) {
      if (!concernAgg.has(concern)) concernAgg.set(concern, { concern, label: taxonomy[concern]?.label || concern, opportunity: 0, risk: 0, neutral: 0 });
      concernAgg.get(concern)[r.direction] += 1;
    }
  }
  const concernMatrix = [...concernAgg.values()].sort((a, b) => b.opportunity + b.risk - (a.opportunity + a.risk));

  const externalReviewed = events.filter((e) => e.kind === "external" && e.status === "reviewed").length;
  const internalCount = events.filter((e) => e.kind === "internal").length;
  const excludedUnreviewed = (runMeta.excluded || []).filter((e) => /V6/.test(e.reason)).length;

  // Diff vs. previous report snapshot.
  const prev = loadPrev(args.prev ? path.resolve(args.cwd, args.prev) : null);
  let diff = null;
  if (prev) {
    const prevEventIds = new Set((prev.events || []).map((e) => e.id));
    const prevPairs = new Map((prev.reactions || []).map((r) => [`${r.persona_id}::${r.event_id}`, r]));
    const prevRank = new Map((prev.events || []).map((e) => [e.id, { rank: e.rank, priority: e.priority }]));
    diff = {
      has_prev: true,
      prev_run: prev.run_id || null,
      new_events: events.filter((e) => !prevEventIds.has(e.id)).map((e) => e.id),
      changed_pairs: [],
      priority_changes: [],
    };
    for (const r of enrichedReactions) {
      const before = prevPairs.get(`${r.persona_id}::${r.event_id}`);
      if (before && before.sum_mp !== r.sum_mp) {
        diff.changed_pairs.push({ persona_id: r.persona_id, event_id: r.event_id, from: before.sum_mp, to: r.sum_mp });
      }
    }
    for (const e of events) {
      const before = prevRank.get(e.id);
      if (before && (before.rank !== e.rank || before.priority !== e.priority)) {
        diff.priority_changes.push({ event_id: e.id, from_rank: before.rank, to_rank: e.rank, from_priority: before.priority, to_priority: e.priority });
      }
    }
  }

  const limitations = [
    "합성 페르소나 기반 추론이므로 실제 고객 반응과 다를 수 있다. 방향성 참고 자료로만 사용한다.",
    "일부 외부 근거는 홍보성/커머셜 기사일 수 있어 절대 수치보다 성장 추세 근거로만 사용한다.",
    `이번 회차에서 리뷰되지 않아 제외된 외부 이벤트 ${excludedUnreviewed}건은 시뮬레이션에 포함되지 않았다(V6).`,
    "델타는 확실한 근거가 있을 때만 부여하는 보수적 기준이며 confidence=low 반응은 흐리게 렌더된다.",
  ];

  return {
    ok: true,
    run_id: runMeta.run_id || args.run,
    generated_at: new Date().toISOString(),
    backtest: Boolean(runMeta.backtest),
    meta: {
      params: runMeta.params || {},
      pair_count: enrichedReactions.length,
      target_events: runMeta.target_events || eventIds,
      excluded: runMeta.excluded || [],
    },
    counts: {
      events_total: events.length,
      external_reviewed: externalReviewed,
      internal: internalCount,
      excluded_unreviewed: excludedUnreviewed,
      new_events: diff ? diff.new_events.length : null,
    },
    personas,
    events,
    reactions: enrichedReactions,
    heatmap,
    timeline,
    concern_matrix: concernMatrix,
    diff,
    limitations,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.run) {
    console.log(JSON.stringify({ ok: false, error: "Provide --run <run-id>" }, null, 2));
    return 1;
  }
  const result = aggregate(args);
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
