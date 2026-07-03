#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function defaultRuntimeCwd() {
  const cwd = path.resolve(process.cwd());
  return cwd === pluginRoot ? path.dirname(pluginRoot) : cwd;
}

const seedEvents = [
  {
    id: "evt_2025_qoo10_no1",
    kind: "external",
    type: "platform_event",
    title: "Meditherapy Wrinkle Fit Neck Cream Qoo10 Japan ranking signal",
    date_occurred: "2025-06-30",
    date_collected: "2026-07-03",
    market: "JP",
    affected_concerns: ["pigmentation", "sensitive_soothing"],
    affected_channels: ["qoo10"],
    summary: "Public press signal about Meditherapy neck cream performance on Japan Qoo10 rankings.",
    sources: [{ url: "https://www.epnc.co.kr/news/articleView.html?idxno=320648", tier: "press", title: "Qoo10 and Amazon Meditherapy performance report" }],
    status: "unreviewed",
  },
  {
    id: "evt_2025_amazon_mwf",
    kind: "external",
    type: "platform_event",
    title: "Meditherapy neck cream Amazon Most Wished For signal",
    date_occurred: "2025-06-30",
    date_collected: "2026-07-03",
    market: "US",
    affected_concerns: ["pigmentation", "sensitive_soothing"],
    affected_channels: ["amazon"],
    summary: "Public press signal about Meditherapy neck cream demand on Amazon beauty-related rankings.",
    sources: [{ url: "https://m.segyebiz.com/newsView/20250630512900", tier: "press", title: "Global sales growth report" }],
    status: "unreviewed",
  },
  {
    id: "evt_2025_shopee_77_growth",
    kind: "external",
    type: "platform_event",
    title: "Meditherapy Shopee 7.7 growth signal",
    date_occurred: "2025-07-07",
    date_collected: "2026-07-03",
    market: "SEA",
    affected_concerns: ["pigmentation", "home_device"],
    affected_channels: ["shopee"],
    summary: "Public press signal about Meditherapy growth during Shopee 7.7 activity.",
    sources: [{ url: "https://www.newstnt.com/news/articleView.html?idxno=515486", tier: "press", title: "Shopee 7.7 growth report" }],
    status: "unreviewed",
  },
];

function parseArgs(argv) {
  const args = { cwd: defaultRuntimeCwd(), write: false, approve: [], reject: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") args.cwd = path.resolve(argv[++i]);
    else if (arg === "--write") args.write = true;
    else if (arg === "--approve") args.approve = splitList(argv[++i]);
    else if (arg === "--reject") args.reject = splitList(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      console.log(JSON.stringify({ ok: true, usage: "node src/scripts/event-scan.mjs [--write] [--approve 1,evt_id] [--reject 2]" }, null, 2));
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

function loadEvents(cwd) {
  return eventFiles(cwd).flatMap((file) => {
    try {
      return [{ file, data: readYaml(file) }];
    } catch {
      return [];
    }
  });
}

function existingUrls(events) {
  const urls = new Set();
  for (const { data } of events) {
    for (const source of data.sources || []) urls.add(source.url);
  }
  return urls;
}

function scan(args) {
  const events = loadEvents(args.cwd);
  const urls = existingUrls(events);
  const operations = [];
  const dir = path.join(args.cwd, "data", "events", "external");
  for (const event of seedEvents) {
    const file = path.join(dir, `${event.id}.yaml`);
    const urlExists = event.sources.some((source) => urls.has(source.url));
    const fileExists = fs.existsSync(file);
    const action = urlExists ? "skip_url" : fileExists ? "skip_existing" : "create";
    operations.push({ id: event.id, file: path.relative(args.cwd, file), action, title: event.title, sources: event.sources.map((source) => source.url) });
    if (args.write && action === "create") {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, dump(event), "utf8");
    }
  }
  return operations;
}

function queue(cwd) {
  return loadEvents(cwd)
    .filter(({ data }) => data.kind === "external" && data.status === "unreviewed")
    .sort((a, b) => a.data.id.localeCompare(b.data.id))
    .map((item, index) => ({
      index: index + 1,
      id: item.data.id,
      file: path.relative(cwd, item.file),
      title: item.data.title,
      market: item.data.market,
      date_occurred: item.data.date_occurred,
      sources: (item.data.sources || []).map((source) => source.url),
    }));
}

function resolveSelection(queueItems, selections) {
  const ids = new Set();
  for (const selection of selections) {
    if (/^[0-9]+$/.test(selection)) {
      const item = queueItems[Number(selection) - 1];
      if (item) ids.add(item.id);
    } else {
      ids.add(selection);
    }
  }
  return ids;
}

function applyReview(args) {
  const queueItems = queue(args.cwd);
  const approve = resolveSelection(queueItems, args.approve);
  const reject = resolveSelection(queueItems, args.reject);
  const changed = [];
  for (const file of eventFiles(args.cwd)) {
    const data = readYaml(file);
    let status = null;
    if (approve.has(data.id)) status = "reviewed";
    if (reject.has(data.id)) status = "rejected";
    if (!status) continue;
    data.status = status;
    fs.writeFileSync(file, dump(data), "utf8");
    changed.push({ id: data.id, file: path.relative(args.cwd, file), status });
  }
  return changed;
}

function runValidate(cwd) {
  const result = spawnSync(process.execPath, [path.join(pluginRoot, "scripts", "validate.mjs"), path.join(cwd, "data")], { cwd, encoding: "utf8" });
  try {
    return { code: result.status ?? 1, output: JSON.parse(result.stdout) };
  } catch {
    return { code: result.status ?? 1, output: { ok: false, errors: [{ file: "", field: "(validate)", rule: "validate", message: result.stderr || result.stdout }] } };
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const missing = ["data/config.yaml", "data/taxonomy.yaml"].filter((file) => !fs.existsSync(path.join(args.cwd, file)));
  if (missing.length > 0) {
    console.log(JSON.stringify({ ok: false, missing, next: "Run setup first." }, null, 2));
    return 1;
  }

  const scanOperations = (args.write || (args.approve.length === 0 && args.reject.length === 0)) ? scan(args) : [];
  const reviewed = args.approve.length || args.reject.length ? applyReview(args) : [];
  const validation = args.write || reviewed.length ? runValidate(args.cwd) : null;
  const reviewQueue = queue(args.cwd);
  const ok = !validation || validation.code === 0;
  console.log(JSON.stringify({
    ok,
    mode: args.write ? "write" : "preview",
    scan: scanOperations,
    reviewed,
    review_queue: reviewQueue,
    validation: validation?.output ?? null,
    next: reviewQueue.length > 0 ? "Approve or reject review_queue items before simulation." : "No unreviewed external events remain.",
  }, null, 2));
  return ok ? 0 : 1;
}

process.exitCode = main();
