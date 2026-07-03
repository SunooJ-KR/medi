#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import Ajv2020 from "ajv/dist/2020.js";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaDir = path.join(pluginRoot, "schemas");
const ajv = new Ajv2020({ allErrors: true, strict: false });

const schemas = {
  config: loadJson(path.join(schemaDir, "config.schema.json")),
  persona: loadJson(path.join(schemaDir, "persona.schema.json")),
  event: loadJson(path.join(schemaDir, "event.schema.json")),
  reaction: loadJson(path.join(schemaDir, "reaction.schema.json")),
};

const validators = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)]),
);

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readData(file) {
  const raw = fs.readFileSync(file, "utf8");
  if (file.endsWith(".json")) return JSON.parse(raw);
  return yaml.load(raw, { schema: yaml.JSON_SCHEMA });
}

function walk(target) {
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved)) {
    return [{ missing: true, file: resolved }];
  }
  const stat = fs.statSync(resolved);
  if (stat.isFile()) return [resolved];
  const out = [];
  for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
    const full = path.join(resolved, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ya?ml|json)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function classify(file, data) {
  const normalized = file.replaceAll("\\", "/");
  const base = path.basename(file).toLowerCase();
  if (base === "config.yaml" || base === "config.yml" || base === "config.json") return "config";
  if (base === "taxonomy.yaml" || base === "taxonomy.yml" || base === "taxonomy.json") return "taxonomy";
  if (normalized.includes("/personas/") || data?.bmap_baseline) return "persona";
  if (normalized.includes("/events/") || data?.kind) return "event";
  if (normalized.includes("/reactions/") || (data?.persona_id && data?.event_id)) return "reaction";
  return "unknown";
}

function schemaRule(kind) {
  if (kind === "event") return "V1";
  if (kind === "persona") return "V2";
  if (kind === "reaction") return "V4";
  return "schema";
}

function addError(errors, file, field, rule, message) {
  errors.push({ file: path.relative(process.cwd(), file), field, rule, message });
}

function formatAjvPath(error) {
  if (error.instancePath) return error.instancePath.replace(/^\//, "").replaceAll("/", ".");
  if (error.params?.missingProperty) return error.params.missingProperty;
  return "(root)";
}

function validateTaxonomy(file, data, errors) {
  if (!data || typeof data !== "object" || !data.concerns || typeof data.concerns !== "object") {
    addError(errors, file, "concerns", "taxonomy", "taxonomy.yaml must contain a concerns object.");
    return;
  }
  for (const [id, value] of Object.entries(data.concerns)) {
    if (!/^[a-z0-9_]+$/.test(id)) {
      addError(errors, file, `concerns.${id}`, "taxonomy", "Concern ids must be snake_case.");
    }
    for (const field of ["label", "ingredients", "representative_products"]) {
      if (!(field in value)) addError(errors, file, `concerns.${id}.${field}`, "taxonomy", `Missing ${field}.`);
    }
  }
}

function validateWithSchema(file, kind, data, errors) {
  const validate = validators[kind];
  if (!validate(data)) {
    for (const error of validate.errors || []) {
      addError(errors, file, formatAjvPath(error), schemaRule(kind), error.message || "Schema validation failed.");
    }
  }
}

function collect(files) {
  const records = [];
  const errors = [];
  for (const item of files) {
    if (item?.missing) {
      addError(errors, item.file, "(path)", "input", "Path does not exist.");
      continue;
    }
    try {
      const data = readData(item);
      const kind = classify(item, data);
      records.push({ file: item, kind, data });
      if (kind === "taxonomy") validateTaxonomy(item, data, errors);
      else if (validators[kind]) validateWithSchema(item, kind, data, errors);
      else addError(errors, item, "(file)", "input", "Cannot classify file as config, taxonomy, persona, event, or reaction.");
    } catch (error) {
      addError(errors, item, "(parse)", "parse", error.message);
    }
  }
  return { records, errors };
}

function crossValidate(records, errors) {
  const taxonomies = records.filter((r) => r.kind === "taxonomy").map((r) => r.data);
  const concerns = new Set();
  for (const taxonomy of taxonomies) {
    for (const id of Object.keys(taxonomy?.concerns || {})) concerns.add(id);
  }

  const personas = records.filter((r) => r.kind === "persona");
  const events = records.filter((r) => r.kind === "event");
  const reactions = records.filter((r) => r.kind === "reaction");
  const personaById = new Map(personas.map((r) => [r.data.id, r]));
  const eventById = new Map(events.map((r) => [r.data.id, r]));

  for (const record of [...personas, ...events]) {
    for (const concern of record.data.concerns || record.data.affected_concerns || []) {
      if (concerns.size > 0 && !concerns.has(concern)) {
        addError(errors, record.file, "concerns", "taxonomy", `Unknown concern '${concern}'.`);
      }
    }
  }

  for (const record of events) {
    if (record.data.kind === "external" && (!Array.isArray(record.data.sources) || record.data.sources.length === 0)) {
      addError(errors, record.file, "sources", "V5", "External events must include at least one source.");
    }
  }

  const confirmedCount = personas.filter((r) => (r.data.status || "confirmed") === "confirmed").length;
  if (confirmedCount > 10) {
    const file = personas[0]?.file || process.cwd();
    addError(errors, file, "personas", "V3", `Confirmed persona count is ${confirmedCount}; maximum is 10.`);
  }

  for (const record of reactions) {
    const persona = personaById.get(record.data.persona_id);
    const event = eventById.get(record.data.event_id);
    if (!persona) addError(errors, record.file, "persona_id", "reference", `Unknown persona_id '${record.data.persona_id}'.`);
    if (!event) {
      addError(errors, record.file, "event_id", "reference", `Unknown event_id '${record.data.event_id}'.`);
      continue;
    }
    if (event.data.kind === "external" && event.data.status !== "reviewed") {
      addError(errors, record.file, "event_id", "V6", `External event '${event.data.id}' has status '${event.data.status}' and cannot be simulated.`);
    }
  }
}

function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.log(JSON.stringify({ ok: false, errors: [{ file: "", field: "(args)", rule: "input", message: "Provide at least one file or directory." }] }, null, 2));
    return 1;
  }
  const files = targets.flatMap(walk).sort((a, b) => String(a).localeCompare(String(b)));
  const { records, errors } = collect(files);
  crossValidate(records, errors);
  const result = { ok: errors.length === 0, errors };
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

process.exitCode = main();
