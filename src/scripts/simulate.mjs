#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import yaml from "js-yaml";
import { runMatch } from "./match.mjs";

function defaultRuntimeCwd() {
  const cwd = path.resolve(process.cwd());
  return path.basename(cwd) === "src" ? path.dirname(cwd) : cwd;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const args = { cwd: defaultRuntimeCwd(), now: todayIso() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") args.cwd = path.resolve(argv[++i]);
    else if (arg === "--since") args.since = argv[++i];
    else if (arg === "--event") args.event = argv[++i];
    else if (arg === "--backtest") args.backtest = argv[++i];
    else if (arg === "--now") args.now = argv[++i];
    else if (arg === "--lookback-weeks") args.lookbackWeeks = Number(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      console.log(JSON.stringify({ ok: true, usage: "node src/scripts/simulate.mjs [--since YYYY-MM-DD] [--event <id>] [--backtest <id>] [--now YYYY-MM-DD] [--cwd <path>]" }, null, 2));
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

// run_YYYY_MM_DD, with _2/_3 suffixes so same-day re-runs stay idempotent.
function allocateRunId(reactionsDir, now) {
  const base = `run_${now.replaceAll("-", "_")}`;
  if (!fs.existsSync(path.join(reactionsDir, base))) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}_${n}`;
    if (!fs.existsSync(path.join(reactionsDir, candidate))) return candidate;
  }
}

export function scaffoldRun(args) {
  const match = runMatch(args);
  if (!match.ok) return match;

  const reactionsDir = path.join(args.cwd, "data", "reactions");
  const runId = allocateRunId(reactionsDir, args.now);
  const runDir = path.join(reactionsDir, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const targetEvents = [...new Set(match.pairs.map((pair) => pair.event_id))];
  const { cwd: _cwd, ...portableParams } = match.params;
  const runMeta = {
    run_id: runId,
    created_at: new Date().toISOString(),
    backtest: Boolean(args.backtest),
    params: portableParams,
    target_events: targetEvents,
    pair_count: match.pairs.length,
    excluded: match.excluded,
  };

  const runFile = path.join(runDir, "run.yaml");
  fs.writeFileSync(runFile, yaml.dump(runMeta, { lineWidth: 100, noRefs: true }), "utf8");

  return {
    ok: true,
    run_id: runId,
    run_dir: path.relative(args.cwd, runDir).replaceAll("\\", "/"),
    run_file: path.relative(args.cwd, runFile).replaceAll("\\", "/"),
    backtest: runMeta.backtest,
    params: match.params,
    pairs: match.pairs,
    excluded: match.excluded,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = scaffoldRun(args);
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
