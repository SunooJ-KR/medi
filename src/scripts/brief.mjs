#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function defaultRuntimeCwd() {
  const cwd = path.resolve(process.cwd());
  return path.basename(cwd) === "src" ? path.dirname(cwd) : cwd;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function splitList(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    cwd: defaultRuntimeCwd(),
    approve: [],
    reject: [],
    writeScan: false,
    now: todayIso(),
    date: todayIso(),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") args.cwd = path.resolve(argv[++i]);
    else if (arg === "--write-scan") args.writeScan = true;
    else if (arg === "--approve") args.approve.push(...splitList(argv[++i]));
    else if (arg === "--reject") args.reject.push(...splitList(argv[++i]));
    else if (arg === "--run") args.run = argv[++i];
    else if (arg === "--event") args.event = argv[++i];
    else if (arg === "--backtest") args.backtest = argv[++i];
    else if (arg === "--since") args.since = argv[++i];
    else if (arg === "--now") {
      args.now = argv[++i];
      if (!args.date) args.date = args.now;
    } else if (arg === "--date") args.date = argv[++i];
    else if (arg === "--lookback-weeks") args.lookbackWeeks = argv[++i];
    else if (arg === "--prev") args.prev = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      console.log(JSON.stringify({
        ok: true,
        usage: "node src/scripts/brief.mjs [--write-scan] [--approve <ids>] [--reject <ids>] [--run <id>|--event <id>|--backtest <id>] [--cwd <path>]",
      }, null, 2));
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

function runJson(command, commandArgs, options) {
  const result = spawnSync(process.execPath, [path.join(pluginRoot, "scripts", command), ...commandArgs], {
    cwd: options.cwd,
    encoding: "utf8",
  });
  let output;
  try {
    output = JSON.parse(result.stdout || "{}");
  } catch {
    output = {
      ok: false,
      error: "Script did not return JSON.",
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
  return { code: result.status ?? 1, output, stderr: result.stderr };
}

function reactionFiles(cwd, runId) {
  const runDir = path.join(cwd, "data", "reactions", runId);
  if (!fs.existsSync(runDir)) return [];
  return fs.readdirSync(runDir).filter((name) => /^r.+\.ya?ml$/i.test(name));
}

function scanArgs(args) {
  const out = ["--cwd", args.cwd];
  if (args.writeScan) out.push("--write");
  if (args.approve.length) out.push("--approve", args.approve.join(","));
  if (args.reject.length) out.push("--reject", args.reject.join(","));
  return out;
}

function simulateArgs(args) {
  const out = ["--cwd", args.cwd, "--now", args.now];
  if (args.since) out.push("--since", args.since);
  if (args.event) out.push("--event", args.event);
  if (args.backtest) out.push("--backtest", args.backtest);
  if (args.lookbackWeeks) out.push("--lookback-weeks", String(args.lookbackWeeks));
  return out;
}

function renderArgs(args, runId) {
  const out = ["--cwd", args.cwd, "--run", runId, "--date", args.date || args.now || todayIso()];
  if (args.prev) out.push("--prev", args.prev);
  return out;
}

export function runBrief(rawArgs = {}) {
  const args = { ...rawArgs };
  args.cwd = path.resolve(args.cwd || defaultRuntimeCwd());
  args.approve = args.approve || [];
  args.reject = args.reject || [];
  args.now = args.now || todayIso();
  args.date = args.date || args.now;

  const validationBefore = runJson("validate.mjs", [path.join(args.cwd, "data")], { cwd: args.cwd });
  if (validationBefore.code !== 0) {
    return {
      ok: false,
      stage: "validate_before",
      validation: validationBefore.output,
      next: "Fix data validation errors before running the brief workflow.",
    };
  }

  const scan = runJson("event-scan.mjs", scanArgs(args), { cwd: args.cwd });
  if (scan.code !== 0 || !scan.output.ok) {
    return { ok: false, stage: "scan", scan: scan.output, next: "Fix event scan errors before continuing." };
  }

  if ((scan.output.review_queue || []).length > 0) {
    return {
      ok: true,
      stage: "review_required",
      scan: scan.output,
      report: null,
      next: "Review the queue, then rerun with --approve or --reject. Simulation and report generation were skipped to preserve V6.",
    };
  }

  let runId = args.run;
  let simulation = null;
  if (!runId) {
    simulation = runJson("simulate.mjs", simulateArgs(args), { cwd: args.cwd });
    if (simulation.code !== 0 || !simulation.output.ok) {
      return { ok: false, stage: "simulate", scan: scan.output, simulation: simulation.output, next: "Fix simulation inputs." };
    }
    runId = simulation.output.run_id;
  }

  const reactions = reactionFiles(args.cwd, runId);
  if (reactions.length === 0) {
    return {
      ok: true,
      stage: "reaction_required",
      scan: scan.output,
      simulation: simulation?.output ?? null,
      run_id: runId,
      report: null,
      next: `Create validated reaction YAML files under data/reactions/${runId}/, then rerun with --run ${runId}.`,
    };
  }

  const validationAfter = runJson("validate.mjs", [path.join(args.cwd, "data")], { cwd: args.cwd });
  if (validationAfter.code !== 0) {
    return {
      ok: false,
      stage: "validate_after",
      scan: scan.output,
      run_id: runId,
      validation: validationAfter.output,
      next: "Fix reaction validation errors before rendering.",
    };
  }

  const report = runJson("render.mjs", renderArgs(args, runId), { cwd: args.cwd });
  return {
    ok: report.code === 0 && report.output.ok,
    stage: report.code === 0 && report.output.ok ? "complete" : "report",
    scan: scan.output,
    simulation: simulation?.output ?? null,
    run_id: runId,
    report: report.output,
    next: report.code === 0 && report.output.ok ? "Review the generated report." : "Fix report rendering errors.",
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runBrief(args);
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
