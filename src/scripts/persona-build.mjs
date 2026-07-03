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

const personas = [
  {
    id: "p01_sensitive_retinal_curious",
    name: "고효능은 원하지만 자극이 무서운 민감성 흔적 케어 고객",
    status: "confirmed",
    market: "KR",
    concerns: ["pigmentation", "sensitive_soothing"],
    demographics: { age_band: "25-34", price_band: "mid" },
    channels: ["olive_young", "own_mall", "instagram"],
    bmap_baseline: {
      motivation: "잡티와 흔적 개선 욕구가 높지만 레티날, AHA/BHA 같은 고효능 성분의 자극 경험을 강하게 회피한다",
      ability: "성분 이해도는 중간이며 사용 순서와 빈도가 명확할 때 루틴을 지속한다",
      prompt: "민감 피부 실사용 후기, 전후 사진, 환불 보장 문구가 첫 구매 계기가 된다",
    },
    evidence: [
      { source: "docs/research.md#8", quote: "고효능 성분은 쓰고 싶지만 자극이 걱정됨", type: "internal" },
      { source: "docs/research.md#3", quote: "고효능 성분과 매일 사용성 사이의 간극", type: "internal" },
    ],
    confidence: "high",
    notes: "저자극 레티날/흔적 케어 메시지 검증의 핵심 페르소나",
  },
  {
    id: "p02_routine_optimizer",
    name: "여러 피부 고민을 한 번에 해결할 루틴을 찾는 복합 고민 고객",
    status: "confirmed",
    market: "KR",
    concerns: ["pores", "pigmentation", "dryness"],
    demographics: { age_band: "25-34", price_band: "mid" },
    channels: ["own_mall", "olive_young", "naver"],
    bmap_baseline: {
      motivation: "모공, 흔적, 속건조가 동시에 있어 단품보다 검증된 조합을 원한다",
      ability: "선택지가 많으면 이탈하지만 7일 키트나 베스트 루틴처럼 묶인 제안은 이해하기 쉽다",
      prompt: "루틴명, 단계별 사용법, 세트 할인, 리뷰 이벤트에 반응한다",
    },
    evidence: [
      { source: "docs/research.md#7.5", quote: "베스트 루틴, 7일 완성 키트, 흔적 리페어 루틴", type: "internal" },
      { source: "docs/research.md#8", quote: "피부 고민별 제품 선택이 어렵고 루틴이 복잡함", type: "internal" },
    ],
    confidence: "high",
    notes: "루틴/세트 판매 전략 평가용",
  },
  {
    id: "p03_home_device_substitute",
    name: "피부과 대신 집에서 탄력 관리를 반복하려는 홈 에스테틱 고객",
    status: "confirmed",
    market: "KR",
    concerns: ["wrinkle_elasticity", "home_device", "dryness"],
    demographics: { age_band: "35-44", price_band: "premium" },
    channels: ["own_mall", "olive_young", "youtube"],
    bmap_baseline: {
      motivation: "피부과 수준의 탄력 관리를 원하지만 비용과 방문 시간을 줄이고 싶다",
      ability: "디바이스 사용법, 세럼 결합 루틴, 안전한 빈도가 명확할수록 시도 가능성이 높다",
      prompt: "사용 영상, 전후 비교, 디바이스와 크림 세트 구성에 반응한다",
    },
    evidence: [
      { source: "docs/research.md#8", quote: "피부과/에스테틱 관리는 비싸고 반복 방문이 어렵다", type: "internal" },
      { source: "docs/research.md#5", quote: "홈케어 디바이스: 슈마지, 속살괄사", type: "internal" },
    ],
    confidence: "high",
    notes: "슈마지/속살괄사와 세럼 결합 제안 평가용",
  },
  {
    id: "p04_review_rank_follower",
    name: "랭킹과 리뷰를 보고 구매 타이밍을 정하는 플랫폼 신뢰 고객",
    status: "confirmed",
    market: "KR",
    concerns: ["pigmentation", "trouble", "sensitive_soothing"],
    demographics: { age_band: "25-44", price_band: "mid" },
    channels: ["olive_young", "qoo10", "amazon", "instagram"],
    bmap_baseline: {
      motivation: "효능 주장이 많아도 플랫폼 랭킹과 다수 리뷰가 있어야 구매 확신을 얻는다",
      ability: "리뷰 수, 별점, 자극 언급 비율, 환불 정책을 비교해 구매 가능성을 판단한다",
      prompt: "Qoo10/Amazon 성과, 올리브영 리뷰, 인플루언서 픽 문구가 즉시 탐색 계기가 된다",
    },
    evidence: [
      { source: "docs/research.md#7.6", quote: "Qoo10, Amazon 등 플랫폼 성과가 반복 보도된다", type: "internal" },
      { source: "docs/research.md#7.4", quote: "공식몰은 리뷰 이벤트, 신규 회원 쿠폰, 100% 환불 보장제를 노출한다", type: "internal" },
    ],
    confidence: "medium",
    notes: "플랫폼 랭킹/UGC 메시지 반응 평가용",
  },
  {
    id: "p05_value_volume_buyer",
    name: "대용량과 세트 할인으로 재구매를 판단하는 가성비 루틴 고객",
    status: "confirmed",
    market: "KR",
    concerns: ["dryness", "pores", "pigmentation"],
    demographics: { age_band: "30-44", price_band: "low" },
    channels: ["own_mall", "naver", "olive_young"],
    bmap_baseline: {
      motivation: "효능 제품을 꾸준히 쓰고 싶지만 가격 부담이 크면 재구매를 미룬다",
      ability: "대용량, 세트 할인, 쿠폰, 명확한 사용량 안내가 있으면 루틴 유지가 쉬워진다",
      prompt: "기간 한정 행사와 장바구니 세트 제안에 반응한다",
    },
    evidence: [
      { source: "docs/research.md#6", quote: "루틴 세트 구성은 객단가와 재구매율을 높이는 방식", type: "internal" },
      { source: "docs/research.md#7.5", quote: "단품보다 루틴 단위로 구매를 유도한다", type: "internal" },
    ],
    confidence: "medium",
    notes: "프로모션/세트 가격 반응 평가용",
  },
  {
    id: "p06_global_kbeauty_discoverer",
    name: "해외 플랫폼에서 K-뷰티 효능과 신뢰를 함께 확인하는 글로벌 탐색 고객",
    status: "confirmed",
    market: "US",
    concerns: ["pigmentation", "sensitive_soothing", "home_device"],
    demographics: { age_band: "25-44", price_band: "mid" },
    channels: ["amazon", "tiktok", "instagram"],
    bmap_baseline: {
      motivation: "K-뷰티 고효능 제품에 관심이 있지만 성분, 사용법, 배송/환불 신뢰를 함께 확인한다",
      ability: "현지어 숏폼, 인플루언서 사용법, Amazon 리뷰가 있으면 구매 장벽이 낮아진다",
      prompt: "TikTok 시딩 콘텐츠와 Amazon 랭킹/위시리스트 성과가 탐색을 촉발한다",
    },
    evidence: [
      { source: "docs/research.md#7.3", quote: "북미 인플루언서 발굴, 제품별 북미 타깃 메시지 및 숏폼 기획", type: "internal" },
      { source: "docs/research.md#8", quote: "해외 소비자에게는 K-뷰티 제품 정보와 신뢰 검증이 어렵다", type: "internal" },
    ],
    confidence: "medium",
    notes: "북미 TikTok/Amazon 확장 메시지 평가용",
  },
];

function parseArgs(argv) {
  const args = { cwd: defaultRuntimeCwd(), write: false, force: false, refresh: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") args.cwd = argv[++i];
    else if (arg === "--write") args.write = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--refresh") args.refresh = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(JSON.stringify({ ok: true, usage: "node src/scripts/persona-build.mjs [--cwd <path>] [--write] [--force] [--refresh]" }, null, 2));
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

function runValidate(args, target) {
  const result = spawnSync(process.execPath, [path.join(pluginRoot, "scripts", "validate.mjs"), target], {
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

function preflight(args) {
  const required = ["data/config.yaml", "data/taxonomy.yaml"];
  const missing = required.filter((file) => !fs.existsSync(path.join(args.cwd, file)));
  if (missing.length === 0) return null;
  return {
    ok: false,
    missing,
    message: "data/config.yaml 또는 data/taxonomy.yaml이 없습니다. 먼저 setup 스킬을 실행하세요.",
    next: "node src/scripts/setup.mjs --write",
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const preflightError = preflight(args);
  if (preflightError) {
    console.log(JSON.stringify(preflightError, null, 2));
    return 1;
  }

  const personaDir = path.join(args.cwd, "data", "personas");
  const operations = [];
  for (const persona of personas) {
    const file = path.join(personaDir, `${persona.id}.yaml`);
    const exists = fs.existsSync(file);
    const action = exists ? (args.force ? "overwrite" : "skip") : "create";
    operations.push({
      id: persona.id,
      file: path.relative(args.cwd, file),
      action,
      concerns: persona.concerns,
      evidence_count: persona.evidence.length,
    });
    if (args.write && action !== "skip") {
      fs.mkdirSync(personaDir, { recursive: true });
      fs.writeFileSync(file, dump(persona), "utf8");
    }
  }

  const validation = args.write ? runValidate(args, path.join(args.cwd, "data")) : null;
  const ok = !args.write || validation?.code === 0;
  console.log(JSON.stringify({
    ok,
    mode: args.write ? "write" : "preview",
    refresh: args.refresh,
    cwd: args.cwd,
    operations,
    validation: validation?.output ?? null,
    next: ok ? "Review persona YAML files and continue to Phase 2 event pipeline." : "Fix validation errors before continuing.",
  }, null, 2));
  return ok ? 0 : 1;
}

process.exitCode = main();
