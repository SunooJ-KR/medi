#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultRuntimeCwd = () => {
  const cwd = path.resolve(process.cwd());
  return cwd === pluginRoot ? path.dirname(pluginRoot) : cwd;
};

const defaultConfig = {
  company: {
    name: "메디테라피",
    official_urls: ["https://meditherapy.co.kr/"],
  },
  markets: ["KR"],
  default_market: "KR",
  channels: ["own_mall", "olive_young", "sikor", "duty_free", "amazon", "qoo10", "shopee"],
  default_channels: ["own_mall", "olive_young"],
  competitors: [
    { name: "메디큐브(APR)", keywords: ["메디큐브", "AGE-R", "에이지알"] },
    { name: "토리든", keywords: ["토리든"] },
    { name: "라운드랩", keywords: ["라운드랩"] },
    { name: "메디힐", keywords: ["메디힐"] },
    { name: "아비브", keywords: ["아비브"] },
  ],
  scan: {
    lookback_weeks: 8,
    extra_keywords: ["레티날", "PDRN", "홈에스테틱", "K뷰티 규제"],
    source_whitelist: [],
  },
};

const defaultTaxonomy = {
  concerns: {
    sensitive_soothing: {
      label: "민감/진정",
      ingredients: ["시카", "PDRN", "판테놀"],
      representative_products: ["토타롤 스프레이 세럼", "PDRN 스킨부스터", "판테놀 크림"],
    },
    pores: {
      label: "모공",
      ingredients: ["비피다", "블러 파우더", "AHA", "BHA"],
      representative_products: ["포쎄라 비피다 블러 세럼", "포쎄라 핑크 블러 크림"],
    },
    pigmentation: {
      label: "잡티/미백/흔적",
      ingredients: ["레티날", "트라넥삼산", "알부틴", "비타민"],
      representative_products: ["레티날 스킨부스터 세럼", "트라넥삼산 크림", "알부틴 스킨부스터"],
    },
    wrinkle_elasticity: {
      label: "주름/탄력",
      ingredients: ["레티날", "펩타이드", "콜라겐"],
      representative_products: ["슈마지 골드실 리프팅", "링클핏", "레티날 크림"],
    },
    dryness: {
      label: "건조/보습",
      ingredients: ["히알루론산", "판테놀", "세라마이드"],
      representative_products: ["히알루론산 퍼스트 세럼", "판테놀 크림"],
    },
    trouble: {
      label: "트러블",
      ingredients: ["시카", "살리실산", "토타롤"],
      representative_products: ["토타롤 스프레이 세럼", "스팟패치"],
    },
    home_device: {
      label: "홈케어 디바이스",
      ingredients: ["중주파", "흡수 부스터", "괄사"],
      representative_products: ["슈마지", "속살괄사"],
    },
  },
};

function parseArgs(argv) {
  const args = { cwd: defaultRuntimeCwd(), write: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") args.cwd = argv[++i];
    else if (arg === "--write") args.write = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(JSON.stringify({ ok: true, usage: "node src/scripts/setup.mjs [--cwd <path>] [--write] [--force]" }, null, 2));
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  args.cwd = path.resolve(args.cwd);
  return args;
}

function dump(data) {
  return yaml.dump(data, { lineWidth: -1, noRefs: true, sortKeys: false });
}

function plannedWrite(file, data, args, operations) {
  const exists = fs.existsSync(file);
  const action = exists ? (args.force ? "overwrite" : "skip") : "create";
  operations.push({ file: path.relative(args.cwd, file), action });
  if (!args.write || action === "skip") return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, dump(data), "utf8");
}

function runValidate(args, files) {
  const result = spawnSync(process.execPath, [path.join(pluginRoot, "scripts", "validate.mjs"), ...files], {
    cwd: args.cwd,
    encoding: "utf8",
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = { ok: false, errors: [{ file: "", field: "(validate)", rule: "validate", message: result.stderr || result.stdout }] };
  }
  return { code: result.status ?? 1, output: parsed, stderr: result.stderr.trim() };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = path.join(args.cwd, "data");
  const configPath = path.join(dataDir, "config.yaml");
  const taxonomyPath = path.join(dataDir, "taxonomy.yaml");
  const operations = [];

  plannedWrite(configPath, defaultConfig, args, operations);
  plannedWrite(taxonomyPath, defaultTaxonomy, args, operations);

  let validation = null;
  if (args.write) {
    validation = runValidate(args, [configPath, taxonomyPath]);
  }

  const ok = !args.write || validation?.code === 0;
  console.log(JSON.stringify({
    ok,
    mode: args.write ? "write" : "preview",
    cwd: args.cwd,
    operations,
    validation: validation?.output ?? null,
    next: ok ? "Review the generated files, then run persona-build." : "Fix validation errors before continuing.",
  }, null, 2));
  return ok ? 0 : 1;
}

process.exitCode = main();
