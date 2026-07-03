#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const internalTypes = new Set(["product_launch", "reformulation", "price_change", "promotion", "campaign", "stockout", "pr_issue", "channel_entry"]);
const externalTypes = new Set(["competitor_launch", "competitor_promotion", "platform_policy", "platform_event", "regulation", "ingredient_trend", "influencer_issue", "seasonal", "macro"]);

function defaultRuntimeCwd() {
  const cwd = path.resolve(process.cwd());
  return cwd === pluginRoot ? path.dirname(pluginRoot) : cwd;
}

function parseArgs(argv) {
  const args = { cwd: defaultRuntimeCwd(), write: false, force: false, kind: "internal", kindProvided: false, sources: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") args.cwd = path.resolve(argv[++i]);
    else if (arg === "--write") args.write = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--external") {
      args.kind = "external";
      args.kindProvided = true;
    } else if (arg === "--kind") {
      args.kind = argv[++i];
      args.kindProvided = true;
    }
    else if (arg === "--id") args.id = argv[++i];
    else if (arg === "--type") args.type = argv[++i];
    else if (arg === "--title") args.title = argv[++i];
    else if (arg === "--date") args.date = argv[++i];
    else if (arg === "--collected") args.date_collected = argv[++i];
    else if (arg === "--market") args.market = argv[++i];
    else if (arg === "--concerns") args.affected_concerns = splitList(argv[++i]);
    else if (arg === "--channels") args.affected_channels = splitList(argv[++i]);
    else if (arg === "--summary") args.summary = argv[++i];
    else if (arg === "--status") args.status = argv[++i];
    else if (arg === "--source-url") args.sources.push({ url: argv[++i], tier: "press" });
    else if (arg === "--source-tier") {
      if (args.sources.length === 0) args.sources.push({ url: "", tier: argv[++i] });
      else args.sources[args.sources.length - 1].tier = argv[++i];
    } else if (arg === "--source-title") {
      if (args.sources.length === 0) args.sources.push({ url: "", tier: "press", title: argv[++i] });
      else args.sources[args.sources.length - 1].title = argv[++i];
    } else if (arg === "--confirm") args.confirm = argv[++i];
    else if (arg === "--edit") args.edit = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      console.log(JSON.stringify({ ok: true, usage: "node src/scripts/event-add.mjs --type <type> --title <title> --date YYYY-MM-DD --concerns a,b --summary <text> [--external --source-url <url>] [--write]" }, null, 2));
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

function splitList(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function dump(data) {
  return yaml.dump(data, { lineWidth: -1, noRefs: true, sortKeys: false });
}

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, "utf8"), { schema: yaml.JSON_SCHEMA });
}

function eventFiles(cwd) {
  const root = path.join(cwd, "data", "events");
  if (!fs.existsSync(root)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.ya?ml$/i.test(entry.name)) out.push(full);
    }
  };
  walk(root);
  return out;
}

function findEventFile(cwd, id) {
  return eventFiles(cwd).find((file) => {
    try {
      return readYaml(file)?.id === id;
    } catch {
      return false;
    }
  });
}

function slug(value) {
  const ascii = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return ascii || "event";
}

function hash(value) {
  let h = 0;
  for (const char of String(value)) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h.toString(36).slice(0, 6);
}

function buildId(args) {
  if (args.id) return args.id;
  const year = String(args.date || new Date().toISOString().slice(0, 10)).slice(0, 4);
  return `evt_${year}_${slug(args.type)}_${hash(`${args.title}|${args.date}`)}`;
}

function preflight(args) {
  const missingBase = ["data/config.yaml", "data/taxonomy.yaml"].filter((file) => !fs.existsSync(path.join(args.cwd, file)));
  if (missingBase.length > 0) return missingBase.map((file) => ({ file, field: "(precondition)", rule: "setup", message: "config/taxonomy missing. Run setup first." }));
  return [];
}

function eventFromArgs(args) {
  const status = args.status || (args.kind === "external" ? "unreviewed" : "planned");
  const event = {
    id: buildId(args),
    kind: args.kind,
    type: args.type,
    title: args.title,
    date_occurred: args.date,
    market: args.market || "KR",
    affected_concerns: args.affected_concerns || [],
    summary: args.summary,
    status,
  };
  if (args.affected_channels?.length) event.affected_channels = args.affected_channels;
  if (args.kind === "external") {
    event.date_collected = args.date_collected || new Date().toISOString().slice(0, 10);
    event.sources = args.sources.filter((source) => source.url);
  }
  return event;
}

function validateEventArgs(args) {
  const errors = preflight(args);
  if (args.kind !== "internal" && args.kind !== "external") errors.push({ field: "kind", rule: "V1", message: "kind must be internal or external." });
  const typeSet = args.kind === "external" ? externalTypes : internalTypes;
  if (!args.type || !typeSet.has(args.type)) errors.push({ field: "type", rule: "V1", message: `Invalid ${args.kind} event type.` });
  for (const field of ["title", "date", "summary"]) {
    if (!args[field]) errors.push({ field, rule: "V1", message: `Missing --${field}.` });
  }
  if (!args.affected_concerns?.length) errors.push({ field: "affected_concerns", rule: "V1", message: "Missing --concerns." });
  if (args.kind === "external" && args.sources.filter((source) => source.url).length === 0) {
    errors.push({ field: "sources", rule: "V5", message: "External events require at least one --source-url." });
  }
  return errors;
}

function validateEventObject(args, event, relativeFile = "") {
  const errors = preflight(args);
  if (event.kind !== "internal" && event.kind !== "external") errors.push({ file: relativeFile, field: "kind", rule: "V1", message: "kind must be internal or external." });
  const typeSet = event.kind === "external" ? externalTypes : internalTypes;
  if (!event.type || !typeSet.has(event.type)) errors.push({ file: relativeFile, field: "type", rule: "V1", message: `Invalid ${event.kind} event type.` });
  for (const field of ["title", "date_occurred", "summary"]) {
    if (!event[field]) errors.push({ file: relativeFile, field, rule: "V1", message: `Missing ${field}.` });
  }
  if (!event.affected_concerns?.length) errors.push({ file: relativeFile, field: "affected_concerns", rule: "V1", message: "Missing affected_concerns." });
  if (event.kind === "external" && (!event.sources || event.sources.length === 0)) {
    errors.push({ file: relativeFile, field: "sources", rule: "V5", message: "External events require at least one source URL." });
  }
  return errors;
}

function runValidate(cwd, target = "data") {
  const result = spawnSync(process.execPath, [path.join(pluginRoot, "scripts", "validate.mjs"), path.join(cwd, target)], { cwd, encoding: "utf8" });
  try {
    return { code: result.status ?? 1, output: JSON.parse(result.stdout) };
  } catch {
    return { code: result.status ?? 1, output: { ok: false, errors: [{ file: "", field: "(validate)", rule: "validate", message: result.stderr || result.stdout }] } };
  }
}

function runDedupe(args) {
  if (!args.type || !args.date || !args.title) return [];
  const result = spawnSync(process.execPath, [
    path.join(pluginRoot, "scripts", "dedupe.mjs"),
    "--cwd", args.cwd,
    "--type", args.type,
    "--date", args.date,
    "--title", args.title,
  ], { cwd: args.cwd, encoding: "utf8" });
  try {
    return JSON.parse(result.stdout).candidates || [];
  } catch {
    return [];
  }
}

function confirmEvent(args) {
  const file = findEventFile(args.cwd, args.confirm);
  if (!file) return { ok: false, errors: [{ field: "id", rule: "input", message: `Event not found: ${args.confirm}` }] };
  const event = readYaml(file);
  if (event.kind !== "internal" || event.status !== "planned") {
    return { ok: false, errors: [{ file: path.relative(args.cwd, file), field: "status", rule: "V1", message: "Only planned internal events can be confirmed." }] };
  }
  if (args.write) {
    event.status = "occurred";
    if (args.date) event.date_occurred = args.date;
    if (args.summary) event.summary = args.summary;
    fs.writeFileSync(file, dump(event), "utf8");
  }
  const validation = args.write ? runValidate(args.cwd) : null;
  return { ok: !args.write || validation.code === 0, action: args.write ? "confirm" : "preview_confirm", file: path.relative(args.cwd, file), validation: validation?.output ?? null };
}

function editEvent(args) {
  const file = findEventFile(args.cwd, args.edit);
  if (!file) return { ok: false, errors: [{ field: "id", rule: "input", message: `Event not found: ${args.edit}` }] };
  const event = readYaml(file);
  const before = structuredClone(event);

  if (args.kindProvided && args.kind !== event.kind) event.kind = args.kind;
  if (args.type) event.type = args.type;
  if (args.title) event.title = args.title;
  if (args.date) event.date_occurred = args.date;
  if (args.date_collected) event.date_collected = args.date_collected;
  if (args.market) event.market = args.market;
  if (args.affected_concerns) event.affected_concerns = args.affected_concerns;
  if (args.affected_channels) event.affected_channels = args.affected_channels;
  if (args.summary) event.summary = args.summary;
  if (args.status) event.status = args.status;
  if (args.sources.length > 0) event.sources = args.sources.filter((source) => source.url);

  if (event.kind === "internal") {
    delete event.date_collected;
    delete event.sources;
  } else if (!event.date_collected) {
    event.date_collected = new Date().toISOString().slice(0, 10);
  }

  const relativeFile = path.relative(args.cwd, file);
  const errors = validateEventObject(args, event, relativeFile);
  const duplicateArgs = { cwd: args.cwd, type: event.type, date: event.date_occurred, title: event.title };
  const duplicates = runDedupe(duplicateArgs).filter((candidate) => candidate.id !== event.id);
  if (errors.length > 0) {
    return { ok: false, action: "preview_edit", file: relativeFile, before, event, duplicates, errors };
  }

  if (args.write) {
    fs.writeFileSync(file, dump(event), "utf8");
  }
  const validation = args.write ? runValidate(args.cwd) : null;
  return {
    ok: !args.write || validation.code === 0,
    action: args.write ? "edit" : "preview_edit",
    file: relativeFile,
    before,
    event,
    duplicates,
    validation: validation?.output ?? null,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.edit) {
    const result = editEvent(args);
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }
  if (args.confirm) {
    const result = confirmEvent(args);
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  const errors = validateEventArgs(args);
  const event = eventFromArgs(args);
  const duplicates = runDedupe(args);
  if (errors.length > 0) {
    console.log(JSON.stringify({ ok: false, event, duplicates, errors }, null, 2));
    return 1;
  }

  const dir = path.join(args.cwd, "data", "events", args.kind);
  const file = path.join(dir, `${event.id}.yaml`);
  const exists = fs.existsSync(file);
  const action = exists ? (args.force ? "overwrite" : "skip") : "create";
  if (args.write && action !== "skip") {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, dump(event), "utf8");
  }
  const validation = args.write ? runValidate(args.cwd) : null;
  const ok = !args.write || validation.code === 0;
  console.log(JSON.stringify({
    ok,
    mode: args.write ? "write" : "preview",
    action,
    event,
    file: path.relative(args.cwd, file),
    duplicates,
    validation: validation?.output ?? null,
  }, null, 2));
  return ok ? 0 : 1;
}

process.exitCode = main();
