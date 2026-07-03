#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";

function defaultRuntimeCwd() {
  const cwd = path.resolve(process.cwd());
  return path.basename(cwd) === "src" ? path.dirname(cwd) : cwd;
}

function parseArgs(argv) {
  const args = { cwd: defaultRuntimeCwd(), windowDays: 7 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") args.cwd = path.resolve(argv[++i]);
    else if (arg === "--type") args.type = argv[++i];
    else if (arg === "--date") args.date = argv[++i];
    else if (arg === "--title") args.title = argv[++i];
    else if (arg === "--window-days") args.windowDays = Number(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      console.log(JSON.stringify({ ok: true, usage: "node src/scripts/dedupe.mjs --type <type> --date YYYY-MM-DD --title <title> [--cwd <path>]" }, null, 2));
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

function walkEvents(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walkEvents(full));
    else if (/\.ya?ml$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function daysBetween(a, b) {
  const left = Date.parse(`${a}T00:00:00Z`);
  const right = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(left) || Number.isNaN(right)) return Number.POSITIVE_INFINITY;
  return Math.abs(left - right) / 86_400_000;
}

function tokenize(title) {
  return new Set(
    String(title || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 2),
  );
}

function similarity(a, b) {
  const left = tokenize(a);
  const right = tokenize(b);
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function findCandidates(args) {
  const eventDir = path.join(args.cwd, "data", "events");
  const candidates = [];
  for (const file of walkEvents(eventDir)) {
    let data;
    try {
      data = readYaml(file);
    } catch {
      continue;
    }
    if (data?.type !== args.type) continue;
    const dateDistance = daysBetween(data.date_occurred, args.date);
    if (dateDistance > args.windowDays) continue;
    const score = similarity(data.title, args.title);
    if (score <= 0) continue;
    candidates.push({
      id: data.id,
      file: path.relative(args.cwd, file),
      title: data.title,
      type: data.type,
      date_occurred: data.date_occurred,
      status: data.status,
      days_apart: dateDistance,
      similarity: Number(score.toFixed(3)),
    });
  }
  return candidates.sort((a, b) => b.similarity - a.similarity || a.days_apart - b.days_apart);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const missing = ["type", "date", "title"].filter((key) => !args[key]);
  if (missing.length > 0) {
    console.log(JSON.stringify({ ok: false, errors: missing.map((field) => ({ field, message: `Missing --${field}` })) }, null, 2));
    return 1;
  }
  const candidates = findCandidates(args);
  console.log(JSON.stringify({ ok: true, candidates }, null, 2));
  return 0;
}

process.exitCode = main();
