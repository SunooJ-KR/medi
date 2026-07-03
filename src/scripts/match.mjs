#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import yaml from "js-yaml";

const DAY_MS = 86_400_000;

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
      console.log(JSON.stringify({ ok: true, usage: "node src/scripts/match.mjs [--since YYYY-MM-DD] [--event <id>] [--backtest <id>] [--now YYYY-MM-DD] [--cwd <path>]" }, null, 2));
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

function loadRecords(dir) {
  const records = [];
  for (const file of walkYaml(dir)) {
    try {
      const data = readYaml(file);
      if (data && typeof data === "object") records.push(data);
    } catch {
      // Skip unparseable files; validate.mjs is the authority on data health.
    }
  }
  return records;
}

function parseDate(value) {
  if (!value) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

function intersect(a, b) {
  const right = new Set(b || []);
  return [...new Set(a || [])].filter((item) => right.has(item));
}

// An event is inside the lookback window if it starts on/after the cutoff, or
// its active_until keeps it live through the cutoff (active_until extension).
function inWindow(event, cutoffMs) {
  const occurred = parseDate(event.date_occurred);
  if (occurred !== null && occurred >= cutoffMs) return true;
  const activeUntil = parseDate(event.active_until);
  if (activeUntil !== null && activeUntil >= cutoffMs) return true;
  return false;
}

// V6 and internal-status gate. `single` skips the time window for an explicitly
// chosen --event/--backtest, but never bypasses the review gate.
function eventEligibility(event, { cutoffMs, cutoffIso, single }) {
  if (event.kind === "external" && event.status !== "reviewed") {
    return { eligible: false, reason: `external event status '${event.status}' is not 'reviewed' (V6)` };
  }
  if (event.kind === "internal" && !["planned", "occurred"].includes(event.status)) {
    return { eligible: false, reason: `internal event status '${event.status}' is not simulatable` };
  }
  if (!single && !inWindow(event, cutoffMs)) {
    return { eligible: false, reason: `date_occurred ${event.date_occurred} is outside lookback window (cutoff ${cutoffIso})` };
  }
  return { eligible: true };
}

// Pairing rule: concern intersection AND market match AND
// (channel intersection OR event leaves channels unspecified).
function pairPersona(persona, event) {
  if (persona.market !== event.market) return null;
  const concerns = intersect(persona.concerns, event.affected_concerns);
  if (concerns.length === 0) return null;
  const eventChannels = event.affected_channels || [];
  let channels = [];
  if (eventChannels.length > 0) {
    channels = intersect(persona.channels, eventChannels);
    if (channels.length === 0) return null;
  }
  return { concerns_matched: concerns, channels_matched: channels };
}

export function runMatch(args) {
  const dataDir = path.join(args.cwd, "data");
  const configPath = path.join(dataDir, "config.yaml");
  let lookbackWeeks = args.lookbackWeeks;
  if (lookbackWeeks === undefined) {
    try {
      const config = readYaml(configPath);
      lookbackWeeks = Number(config?.scan?.lookback_weeks) || 8;
    } catch {
      lookbackWeeks = 8;
    }
  }

  const single = args.event || args.backtest || null;
  const nowMs = parseDate(args.now) ?? parseDate(todayIso());
  const cutoffMs = args.since ? parseDate(args.since) : nowMs - lookbackWeeks * 7 * DAY_MS;
  const cutoffIso = new Date(cutoffMs).toISOString().slice(0, 10);

  const personas = loadRecords(path.join(dataDir, "personas")).filter(
    (persona) => (persona.status || "confirmed") === "confirmed",
  );
  const allEvents = loadRecords(path.join(dataDir, "events"));
  const eventById = new Map(allEvents.map((event) => [event.id, event]));

  let events = allEvents;
  const excluded = [];
  if (single) {
    const chosen = eventById.get(single);
    if (!chosen) {
      return {
        ok: false,
        params: { cwd: args.cwd, now: args.now, since: args.since ?? null, lookback_weeks: lookbackWeeks, event: args.event ?? null, backtest: args.backtest ?? null, cutoff: cutoffIso },
        pairs: [],
        excluded: [{ event_id: single, reason: "event not found in data/events" }],
      };
    }
    events = [chosen];
  }

  const pairs = [];
  for (const event of events) {
    const eligibility = eventEligibility(event, { cutoffMs, cutoffIso, single: Boolean(single) });
    if (!eligibility.eligible) {
      excluded.push({ event_id: event.id, reason: eligibility.reason });
      continue;
    }
    const eventPairs = [];
    for (const persona of personas) {
      const match = pairPersona(persona, event);
      if (match) {
        eventPairs.push({
          persona_id: persona.id,
          event_id: event.id,
          market: event.market,
          concerns_matched: match.concerns_matched,
          channels_matched: match.channels_matched,
        });
      }
    }
    if (eventPairs.length === 0) {
      excluded.push({ event_id: event.id, reason: "no confirmed persona matched by market, concern, and channel" });
    } else {
      pairs.push(...eventPairs);
    }
  }

  return {
    ok: true,
    params: {
      cwd: args.cwd,
      now: args.now,
      since: args.since ?? null,
      lookback_weeks: lookbackWeeks,
      event: args.event ?? null,
      backtest: args.backtest ?? null,
      cutoff: cutoffIso,
    },
    pairs,
    excluded,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runMatch(args);
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
