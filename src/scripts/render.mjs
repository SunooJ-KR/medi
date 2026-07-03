#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { aggregate } from "./aggregate.mjs";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = path.join(pluginRoot, "templates", "report.html");

function defaultRuntimeCwd() {
  const cwd = path.resolve(process.cwd());
  return path.basename(cwd) === "src" ? path.dirname(cwd) : cwd;
}

function parseArgs(argv) {
  const args = { cwd: defaultRuntimeCwd(), date: new Date().toISOString().slice(0, 10) };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") args.cwd = path.resolve(argv[++i]);
    else if (arg === "--run") args.run = argv[++i];
    else if (arg === "--prev") args.prev = argv[++i];
    else if (arg === "--date") args.date = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      console.log(JSON.stringify({ ok: true, usage: "node src/scripts/render.mjs --run <run-id> [--prev <report>] [--date YYYY-MM-DD] [--cwd <path>]" }, null, 2));
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function truncate(text, n) {
  const s = String(text ?? "");
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function directionBadge(direction) {
  const label = { opportunity: "기회", risk: "리스크", neutral: "중립" }[direction] || direction;
  return `<span class="badge ${esc(direction)}">${esc(label)}</span>`;
}

function confidenceBadge(confidence) {
  const label = { high: "확신 높음", medium: "확신 중간", low: "확신 낮음" }[confidence] || confidence;
  return `<span class="badge conf-${esc(confidence)}">${esc(label)}</span>`;
}

function statusBadge(event) {
  return event.status === "planned" ? '<span class="badge planned">예정</span>' : "";
}

// ---- Charts (inline SVG; dataviz palette via CSS vars) ----

function heatmapSvg(data) {
  const { personas, events, cells } = data.heatmap;
  if (personas.length === 0 || events.length === 0) return "<p class=\"subtle\">표시할 매칭이 없습니다.</p>";
  const eventTitle = new Map(data.events.map((e) => [e.id, e.title || e.id]));
  const personaName = new Map(data.personas.map((p) => [p.id, p.name || p.id]));
  const cellByKey = new Map(cells.map((c) => [`${c.persona_id}::${c.event_id}`, c]));

  const labelW = 190;
  const topH = 84;
  const cw = 96;
  const ch = 44;
  const width = labelW + events.length * cw + 8;
  const height = topH + personas.length * ch + 8;

  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="페르소나 × 이벤트 히트맵">`;
  events.forEach((eid, ci) => {
    const cx = labelW + ci * cw + cw / 2;
    svg += `<text x="${cx}" y="${topH - 8}" text-anchor="middle" font-size="11" fill="var(--muted)"><title>${esc(eventTitle.get(eid))}</title>${esc(truncate(eventTitle.get(eid), 14))}</text>`;
  });
  personas.forEach((pid, ri) => {
    const cy = topH + ri * ch + ch / 2;
    svg += `<text x="${labelW - 10}" y="${cy + 4}" text-anchor="end" font-size="12" fill="var(--text-secondary)"><title>${esc(personaName.get(pid))}</title>${esc(truncate(personaName.get(pid), 22))}</text>`;
    events.forEach((eid, ci) => {
      const x = labelW + ci * cw + 2;
      const y = topH + ri * ch + 2;
      const cell = cellByKey.get(`${pid}::${eid}`);
      if (!cell) {
        svg += `<rect x="${x}" y="${y}" width="${cw - 4}" height="${ch - 4}" rx="4" fill="var(--grid)" opacity="0.4"/>`;
        return;
      }
      const colorVar = cell.direction === "opportunity" ? "var(--opportunity)" : cell.direction === "risk" ? "var(--risk)" : "var(--neutral)";
      const intensity = Math.min(1, Math.max(0.22, Math.abs(cell.value) / 4));
      const faded = cell.confidence === "low" ? 0.45 : 1;
      svg += `<rect x="${x}" y="${y}" width="${cw - 4}" height="${ch - 4}" rx="4" fill="${colorVar}" opacity="${(intensity * faded).toFixed(2)}"><title>${esc(personaName.get(pid))} × ${esc(eventTitle.get(eid))}\n동기+계기 델타 ${cell.value >= 0 ? "+" : ""}${cell.value} · ${cell.direction} · ${cell.confidence}</title></rect>`;
      svg += `<text x="${x + (cw - 4) / 2}" y="${y + (ch - 4) / 2 + 4}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--text-primary)" opacity="${faded}">${cell.value >= 0 ? "+" : ""}${cell.value}</text>`;
    });
  });
  svg += "</svg>";
  const legend = `<div class="legend"><span><span class="swatch" style="background:var(--opportunity)"></span>기회</span><span><span class="swatch" style="background:var(--risk)"></span>리스크</span><span><span class="swatch" style="background:var(--neutral)"></span>중립</span><span>셀 = 동기+계기 델타 합 · 흐린 셀 = 확신 낮음</span></div>`;
  return `<div class="chart-scroll">${svg}</div>${legend}`;
}

function timelineSvg(data) {
  const items = data.timeline.filter((t) => t.date_occurred);
  if (items.length === 0) return "<p class=\"subtle\">타임라인에 표시할 이벤트가 없습니다.</p>";
  const width = 960;
  const height = 120;
  const padX = 40;
  const times = items.map((t) => Date.parse(`${t.date_occurred}T00:00:00Z`));
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min || 1;
  const x = (t) => (items.length === 1 ? width / 2 : padX + ((Date.parse(`${t.date_occurred}T00:00:00Z`) - min) / span) * (width - padX * 2));
  const baseY = 54;

  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="이벤트 타임라인">`;
  svg += `<line x1="${padX}" y1="${baseY}" x2="${width - padX}" y2="${baseY}" stroke="var(--baseline)" stroke-width="2"/>`;
  items.forEach((t, i) => {
    const cx = x(t);
    const colorVar = t.kind === "external" ? "var(--external)" : "var(--internal)";
    const above = i % 2 === 0;
    const labelY = above ? baseY - 16 : baseY + 26;
    svg += `<circle cx="${cx}" cy="${baseY}" r="7" fill="${colorVar}" stroke="var(--surface-1)" stroke-width="2"><title>${esc(t.title || t.id)} (${esc(t.date_occurred)})</title></circle>`;
    svg += `<text x="${cx}" y="${labelY}" text-anchor="middle" font-size="11" fill="var(--text-secondary)">${esc(truncate(t.title || t.id, 18))}</text>`;
    svg += `<text x="${cx}" y="${above ? baseY - 4 : baseY + 38}" text-anchor="middle" font-size="10" fill="var(--muted)" font-variant-numeric="tabular-nums">${esc(t.date_occurred)}</text>`;
  });
  svg += "</svg>";
  const legend = `<div class="legend"><span><span class="swatch" style="background:var(--internal)"></span>내부 이벤트</span><span><span class="swatch" style="background:var(--external)"></span>외부 이벤트</span></div>`;
  return `<div class="chart-scroll">${svg}</div>${legend}`;
}

function concernMatrixSvg(data) {
  const rows = data.concern_matrix;
  if (rows.length === 0) return "<p class=\"subtle\">고민별 데이터가 없습니다.</p>";
  const maxCount = Math.max(1, ...rows.map((r) => Math.max(r.opportunity, r.risk)));
  const labelW = 150;
  const rowH = 34;
  const half = 220;
  const width = labelW + half * 2 + 20;
  const height = rows.length * rowH + 30;
  const centerX = labelW + half;
  const unit = (half - 20) / maxCount;

  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="고민별 기회-리스크 매트릭스">`;
  svg += `<line x1="${centerX}" y1="10" x2="${centerX}" y2="${rows.length * rowH + 10}" stroke="var(--grid)" stroke-width="1"/>`;
  rows.forEach((r, i) => {
    const y = 16 + i * rowH;
    svg += `<text x="${labelW - 10}" y="${y + 14}" text-anchor="end" font-size="12" fill="var(--text-secondary)">${esc(truncate(r.label, 12))}</text>`;
    if (r.risk > 0) {
      const w = r.risk * unit;
      svg += `<rect x="${centerX - w}" y="${y}" width="${w}" height="20" rx="4" fill="var(--risk)"><title>${esc(r.label)} 리스크 반응 ${r.risk}건</title></rect>`;
      svg += `<text x="${centerX - w - 6}" y="${y + 14}" text-anchor="end" font-size="11" fill="var(--muted)">${r.risk}</text>`;
    }
    if (r.opportunity > 0) {
      const w = r.opportunity * unit;
      svg += `<rect x="${centerX + 2}" y="${y}" width="${w}" height="20" rx="4" fill="var(--opportunity)"><title>${esc(r.label)} 기회 반응 ${r.opportunity}건</title></rect>`;
      svg += `<text x="${centerX + w + 8}" y="${y + 14}" font-size="11" fill="var(--muted)">${r.opportunity}</text>`;
    }
  });
  svg += "</svg>";
  const legend = `<div class="legend"><span><span class="swatch" style="background:var(--risk)"></span>리스크(좌)</span><span><span class="swatch" style="background:var(--opportunity)"></span>기회(우)</span></div>`;
  return `<div class="chart-scroll">${svg}</div>${legend}`;
}

// ---- Section fragments ----

function renderSummary(data) {
  const top3 = data.events.slice(0, 3);
  const kpis = `<div class="kpis">
    <div class="kpi"><div class="num">${data.counts.events_total}</div><div class="lbl">대상 이벤트</div></div>
    <div class="kpi"><div class="num">${data.meta.pair_count}</div><div class="lbl">추론된 반응 쌍</div></div>
    <div class="kpi"><div class="num">${data.counts.external_reviewed}</div><div class="lbl">승인된 외부 이벤트</div></div>
    <div class="kpi"><div class="num">${data.counts.excluded_unreviewed}</div><div class="lbl">미승인 제외(V6)</div></div>
  </div>`;
  const lede = `<ul class="lede">
    <li>이번 회차는 ${data.counts.events_total}개 이벤트에 대해 ${data.meta.pair_count}건의 페르소나 반응을 추론했습니다.</li>
    <li>최우선 대응 이벤트는 <strong>${esc(top3[0] ? top3[0].title || top3[0].id : "없음")}</strong> 입니다.</li>
    <li>미승인·제외 외부 이벤트 ${data.counts.excluded_unreviewed}건은 시뮬레이션에서 제외되었습니다.</li>
  </ul>`;
  const priority = top3.length
    ? `<h3 style="font-size:13px;color:var(--text-secondary);margin:8px 0 6px;">대응 우선순위 Top ${top3.length}</h3><ol class="priority">${top3
        .map((e) => `<li><strong>${esc(e.title || e.id)}</strong> ${statusBadge(e)} <span class="subtle">(우선순위 ${e.priority})</span></li>`)
        .join("")}</ol>`
    : "";
  return kpis + lede + priority;
}

function renderViz(data) {
  return `<div class="viz"><h3>페르소나 × 이벤트 히트맵</h3>${heatmapSvg(data)}</div>
    <div class="viz"><h3>이벤트 타임라인</h3>${timelineSvg(data)}</div>
    <div class="viz"><h3>고민별 기회-리스크 매트릭스</h3>${concernMatrixSvg(data)}</div>`;
}

function personaCard(persona) {
  const evidence = (persona.evidence || [])
    .map((ev) => `<li><span class="badge tier">${esc(ev.type)}</span> “${esc(ev.quote)}” <span class="evref">— ${esc(ev.source)}</span></li>`)
    .join("");
  const bmap = persona.bmap_baseline || {};
  return `<div class="card">
    <h3>${esc(persona.name || persona.id)}</h3>
    <div class="meta">${esc(persona.id)} · ${esc(persona.market || "")} · 고민: ${esc((persona.concerns || []).join(", "))} · ${confidenceBadge(persona.confidence)}</div>
    <div class="deltas">M: ${esc(bmap.motivation || "")}<br/>A: ${esc(bmap.ability || "")}<br/>P: ${esc(bmap.prompt || "")}</div>
    <details><summary>근거 ${((persona.evidence || []).length)}건</summary><ul class="tight">${evidence}</ul></details>
  </div>`;
}

function sourceLinks(event) {
  const sources = event.sources || [];
  if (sources.length === 0) return "";
  return `<ul class="tight">${sources
    .map((s) => `<li><span class="badge tier">${esc(s.tier)}</span> <a href="${esc(s.url)}" rel="noreferrer noopener">${esc(s.title || s.url)}</a></li>`)
    .join("")}</ul>`;
}

function reactionBlock(data, reaction, { actualColumn }) {
  const persona = data.personas.find((p) => p.id === reaction.persona_id) || { id: reaction.persona_id };
  const d = reaction.deltas || {};
  const lowClass = reaction.confidence === "low" ? " low-conf" : "";
  const behaviors = (reaction.predicted_behaviors || []).map((b) => `<li>${esc(b)}</li>`).join("");
  const actions = (reaction.suggested_actions || []).map((a) => `<li>${esc(a)}</li>`).join("");
  const refs = (reaction.evidence_refs || []).map((r) => esc(r)).join(", ");
  const predicted = `<div class="reaction${lowClass}">
    <div><strong>${esc(persona.name || persona.id)}</strong> ${directionBadge(reaction.direction)} ${confidenceBadge(reaction.confidence)}</div>
    <div class="deltas">Δ 동기 ${d.motivation >= 0 ? "+" : ""}${d.motivation} · 능력 ${d.ability >= 0 ? "+" : ""}${d.ability} · 계기 ${d.prompt >= 0 ? "+" : ""}${d.prompt}</div>
    <p style="margin:6px 0;">${esc(reaction.rationale)}</p>
    <div class="subtle">예상 행동</div><ul class="tight">${behaviors}</ul>
    <div class="subtle">제안 액션</div><ul class="tight">${actions}</ul>
    <div class="evref">근거: ${refs}</div>
  </div>`;
  if (!actualColumn) return predicted;
  return `<div class="cols"><div>${predicted}</div><div class="actual-col"><div class="subtle">실제 관찰(백테스트)</div><p><em>발생 후 실제 반응·후속 보도를 여기에 대조 기록합니다.</em></p></div></div>`;
}

function renderDetails(data) {
  const personas = data.personas.map(personaCard).join("");
  const events = data.events
    .map((event) => {
      const reactions = data.reactions.filter((r) => r.event_id === event.id);
      const blocks = reactions.map((r) => reactionBlock(data, r, { actualColumn: data.backtest })).join("");
      return `<div class="card">
        <h3>${esc(event.title || event.id)} ${statusBadge(event)} <span class="badge tier">${esc(event.kind)}</span></h3>
        <div class="meta">${esc(event.id)} · ${esc(event.type || "")} · ${esc(event.market || "")} · ${esc(event.date_occurred || "")} · 우선순위 ${event.priority}</div>
        <p style="margin:6px 0;">${esc(event.summary || "")}</p>
        ${sourceLinks(event)}
        ${blocks}
      </div>`;
    })
    .join("");
  return `<h3 style="font-size:14px;margin:4px 0;">페르소나</h3>${personas}<h3 style="font-size:14px;margin:18px 0 4px;">이벤트 · 반응</h3>${events}`;
}

function renderChanges(data) {
  const diff = data.diff;
  if (!diff || !diff.has_prev) {
    return `<p class="changes-empty">직전 보고서가 지정되지 않았습니다(<code>--prev</code>). 두 번째 회차부터 신규 이벤트·델타 변경·우선순위 변동이 여기에 표시됩니다.</p>`;
  }
  const newEvents = diff.new_events.length
    ? `<p><strong>신규 이벤트 ${diff.new_events.length}건:</strong> ${diff.new_events.map(esc).join(", ")}</p>`
    : "<p class=\"changes-empty\">신규 이벤트 없음.</p>";
  const changed = diff.changed_pairs.length
    ? `<table class="diff"><tr><th>페르소나</th><th>이벤트</th><th>델타 변화</th></tr>${diff.changed_pairs
        .map((c) => `<tr><td>${esc(c.persona_id)}</td><td>${esc(c.event_id)}</td><td>${c.from} → ${c.to}</td></tr>`)
        .join("")}</table>`
    : "<p class=\"changes-empty\">델타 변경 쌍 없음.</p>";
  const priority = diff.priority_changes.length
    ? `<table class="diff"><tr><th>이벤트</th><th>순위 변화</th><th>우선순위</th></tr>${diff.priority_changes
        .map((p) => `<tr><td>${esc(p.event_id)}</td><td>${p.from_rank} → ${p.to_rank}</td><td>${p.from_priority} → ${p.to_priority}</td></tr>`)
        .join("")}</table>`
    : "<p class=\"changes-empty\">우선순위 변동 없음.</p>";
  return `<p class="subtle">직전 run: ${esc(diff.prev_run || "-")}</p>${newEvents}<h3 style="font-size:13px;margin:12px 0 4px;">델타 변경 쌍</h3>${changed}<h3 style="font-size:13px;margin:12px 0 4px;">우선순위 변동</h3>${priority}`;
}

function renderLimitations(data) {
  return `<ul>${data.limitations.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

function backtestBanner(data) {
  if (!data.backtest) return "";
  return `<div class="backtest-banner"><strong>백테스트 모드</strong> — 이벤트 발생일 이후의 정보를 근거로 사용하지 않고 추론했습니다. 상세 섹션은 추론 대 실제 비교 레이아웃으로 표시됩니다.</div>`;
}

function buildHtml(data) {
  const template = fs.readFileSync(TEMPLATE, "utf8");
  const title = `메디테라피 시장 반응 리포트 · ${data.run_id}`;
  return template
    .replaceAll("{{TITLE}}", esc(title))
    .replace("{{RUN_ID}}", esc(data.run_id))
    .replace("{{GENERATED_AT}}", esc(data.generated_at))
    .replace("{{BACKTEST_BANNER}}", backtestBanner(data))
    .replace("{{SUMMARY}}", renderSummary(data))
    .replace("{{VIZ}}", renderViz(data))
    .replace("{{DETAILS}}", renderDetails(data))
    .replace("{{CHANGES}}", renderChanges(data))
    .replace("{{LIMITATIONS}}", renderLimitations(data));
}

function allocatePath(reportsDir, date) {
  const base = path.join(reportsDir, `${date}.html`);
  if (!fs.existsSync(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = path.join(reportsDir, `${date}-${n}.html`);
    if (!fs.existsSync(candidate)) return candidate;
  }
}

export function render(args) {
  const data = aggregate(args);
  if (!data.ok) return data;
  const reportsDir = path.join(args.cwd, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const htmlPath = allocatePath(reportsDir, args.date);
  const jsonPath = htmlPath.replace(/\.html$/, ".json");
  fs.writeFileSync(htmlPath, buildHtml(data), "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf8");
  return {
    ok: true,
    path: path.relative(args.cwd, htmlPath).replaceAll("\\", "/"),
    snapshot: path.relative(args.cwd, jsonPath).replaceAll("\\", "/"),
    run_id: data.run_id,
    backtest: data.backtest,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.run) {
    console.log(JSON.stringify({ ok: false, error: "Provide --run <run-id>" }, null, 2));
    return 1;
  }
  const result = render(args);
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
