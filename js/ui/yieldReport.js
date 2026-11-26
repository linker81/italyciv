import { U } from "../format.js";
import { t as tr } from "../i18n.js";
// Top-bar reports: click a national stat (population, a yield, the employment rate) for a Civ-style dropdown with its
// definition, what makes it up, and region / city leaderboards.
//
// The first half is pure data (statDefs, buildReport): plain objects from nation.json, states.json, cities.json and
// lenses.json, no DOM, so it is easy to check from the console (`window.__app.reports`). The second half renders.
import { DEC, locale } from "../i18n.js";
import { compact, dollars, esc, int, money, pct } from "../format.js";
import { icon, glyph } from "./icon.js";

export const METRO_MIN = 0; // every province-city is ranked
const TOP = 8;
// A related map lens for some reports (shown only when lenses.json has it). These are related measures, not the
// report's own total, and the button says so.
const LENS_FOR = { population: "density", gold: "income", food: "restaurants", production: "employment", science: "bachelors", culture: "culture", employment: "employment" };
// The advisor dashboard (ext/advisors) that explores each report further. Buttons show only when the advisors
// extension is installed.
const ADVISOR_FOR = {
  population: [{ id: "people", label: tr("Popolazione", "People") }],
  gold: [{ id: "prosperity", label: tr("Benessere e casa", "Prosperity & housing") }],
  food: [{ id: "culture", label: tr("Cultura", "Culture") }],
  production: [{ id: "prosperity", label: tr("Benessere e casa", "Prosperity & housing") }, { id: "energy", label: tr("Energia e risorse", "Energy & resources") }],
  science: [{ id: "knowledge", label: tr("Conoscenza", "Knowledge") }],
  culture: [{ id: "culture", label: tr("Cultura", "Culture") }],
  employment: [{ id: "prosperity", label: tr("Benessere e casa", "Prosperity & housing") }],
};
const advisorApp = () => (typeof window !== "undefined" && window.__app?.hasMode?.("advisor") ? window.__app : null);

const fin = Number.isFinite;
const ratio = (a, b) => (fin(a) && fin(b) && b > 0 ? a / b : null);
const comma = (s) => s.replace(".", DEC);
export const signedPct = (g, d = 1) => (fin(g) ? `${g >= 0 ? "+" : "−"}${comma(Math.abs(g * 100).toFixed(d))}%` : "–");

// Counts to three significant figures (leaderboards: 1,12 mln vs 1,11 mln rather than 1,1 mln twice).
export function count3(n) {
  if (!fin(n)) return "–";
  const a = Math.abs(n);
  const sig = (d, unit) => comma((n / d).toFixed(a / d >= 100 ? 0 : a / d >= 10 ? 1 : 2)) + unit;
  if (a >= 1e9) return sig(1e9, U.b);
  if (a >= 1e6) return sig(1e6, U.m);
  if (a >= 1e4) return sig(1e3, U.k);
  return int(n);
}

// Formats a value of a stat ("usd" → €, "rate" → %, anything else → compact count).
export function fmtStat(def, v) {
  if (!fin(v)) return "–";
  if (def.unit === "usd") return money(v);
  if (def.unit === "rate") return pct(v);
  return compact(v);
}

// Every top-bar stat in display order: population, the yields from nation.json, the employment rate.
export function statDefs(nation) {
  const n = nation?.nation || {};
  const yields = (nation?.yields || []).map((y) => ({
    key: y.key, label: y.label, name: y.label, color: y.color, yield: y, unit: y.unit,
    description: y.description || "", source: nation.vintage || "", value: n.yields?.[y.key] ?? null,
  }));
  return [
    {
      key: "population", label: tr("Popolazione", "Population"), name: tr("Popolazione", "Population"), color: "#e8dcc0", iconId: "pop", emoji: "👥", unit: "people",
      description: tr("Residenti al 1° gennaio 2023 (ISTAT).", "Residents on 1 January 2023 (ISTAT)."), source: "ISTAT", value: n.population ?? null,
    },
    ...yields,
    {
      key: "employment", label: tr("Occupazione", "Employment"), name: tr("Tasso di occupazione", "Employment rate"), color: "#e8dcc0", iconId: "unemployment", emoji: "🏭",
      unit: "rate", description: tr("Occupati di 15-64 anni ÷ residenti di 15-64 anni (ISTAT 2019, in Qualità della vita 2020). Il dato nazionale è la media delle province pesata per popolazione.", "Employed people aged 15-64 ÷ residents aged 15-64 (ISTAT 2019, in Qualità della vita 2020). The national figure is the population-weighted mean of the provinces."),
      source: "ISTAT, via Il Sole 24 Ore", value: n.employment_rate ?? null,
    },
  ];
}

// Areas the leaderboards rank: regions (index into states.json = world.json states) and cities (provinces).
function areas(states, cities) {
  const st = (Array.isArray(states) ? states : [])
    .map((o, i) => (o ? { kind: "state", ref: i, name: o.name || o.abbr || "?", sub: o.abbr || "", o } : null))
    .filter(Boolean);
  const metros = (Array.isArray(cities) ? cities : [])
    .map((c) => ({ kind: "city", ref: c.id, name: c.name, sub: (c.states || []).join("–"), o: c }));
  return { st, metros };
}

// Top TOP rows by valueOf(o); null values are skipped. opts: {asc, min (population), fmt, exact, subOf}
function rank(list, valueOf, { asc = false, min = 0, fmt = count3, exact = int, subOf = null } = {}) {
  return list
    .filter((r) => !min || (r.o.population ?? 0) >= min)
    .map((r) => ({ r, v: valueOf(r.o) }))
    .filter((x) => fin(x.v))
    .sort((a, b) => (asc ? a.v - b.v : b.v - a.v))
    .slice(0, TOP)
    .map(({ r, v }, i) => ({ rank: i + 1, kind: r.kind, ref: r.ref, name: r.name, sub: subOf ? subOf(r.o) : r.sub, value: v, text: fmt(v), exact: exact ? exact(v) : "" }));
}

function stateScope() {
  return { label: tr("Regioni", "Regions"), inMap: tr("Le regioni", "The regions"), note: "" };
}

// Sorted [{r, v}] of every area with a value (for extremes and medians).
function sorted(list, valueOf, min = 0) {
  return list
    .filter((r) => !min || (r.o.population ?? 0) >= min)
    .map((r) => ({ r, v: valueOf(r.o) }))
    .filter((x) => fin(x.v))
    .sort((a, b) => b.v - a.v);
}

/**
 * The report for one stat, as plain data:
 * {key, def, total, totalText, context: [str], definition, source,
 *  breakdown: {title, note, groups: [{title, rows: [{label, full, iconId, emoji, value, text, sub, tone, strong}]}],
 *              collapseAfter} | null,
 *  boards: {note, modes: [{id, label, hint, states: [row], metros: [row]}]},   row: {rank, kind, ref, name, sub, value, text}
 *  lens: {id, name} | null}
 */
export function buildReport(key, { nation, states, cities, lenses } = {}) {
  const def = statDefs(nation).find((d) => d.key === key);
  if (!def) return null;
  const n = nation.nation || {};
  const { st, metros } = areas(states, cities);
  const scope = stateScope();
  const fmt = (v) => fmtStat(def, v);
  const rep = {
    key, def, total: def.value, totalText: fmt(def.value), context: [], definition: def.description, source: def.source,
    breakdown: null, boards: { note: "", statesNote: scope.note, modes: [] }, lens: null, scope,
  };
  const lensId = LENS_FOR[key];
  const lens = lensId && Array.isArray(lenses) ? lenses.find((l) => l.id === lensId) : null;
  if (lens) rep.lens = { id: lens.id, name: lens.name || lens.id, unit: lens.unit || "", vintage: "" };

  if (key === "population") reportPopulation(rep, n, st, metros);
  else if (key === "employment") reportRate(rep, n, st, metros);
  else if (def.unit === "usd") reportGold(rep, nation, n, st, metros);
  else reportCount(rep, def, nation, n, st, metros);
  return rep;
}

function reportPopulation(rep, n, st, metros) {
  const yrs = Array.isArray(n.growth_years) && n.growth_years.length === 2 ? n.growth_years : null;
  const since = yrs ? tr(` dal 1° gennaio ${yrs[0]}`, ` since 1 January ${yrs[0]}`) : "";
  if (fin(n.growth)) rep.context.push(`${signedPct(n.growth, 2)}${since} (ISTAT)`);
  if (fin(n.median_age)) rep.context.push(tr(`Età mediana ${comma(n.median_age.toFixed(1))} anni`, `Median age ${n.median_age.toFixed(1)}`));

  const g = (o) => o.growth;
  const row = (x) => ({ label: x.r.name, sub: x.r.kind === "city" ? x.r.sub : "", value: x.v, text: signedPct(x.v, 2), tone: x.v >= 0 ? "good" : "bad" });
  const groups = [];
  if (fin(n.growth)) groups.push({ rows: [{ label: tr("Italia", "Italy"), value: n.growth, text: signedPct(n.growth, 2), tone: n.growth >= 0 ? "good" : "bad", strong: true }] });
  const extremes = (list, what) => {
    if (list.length < 2) return;
    const k = Math.min(3, Math.floor(list.length / 2));
    const top = list.slice(0, k), bottom = list.slice(-k).reverse();
    groups.push({ title: tr(`${what} che crescono di più`, `Fastest-growing ${what.toLowerCase()}`), rows: top.map(row) });
    groups.push({ title: bottom.every((x) => x.v < 0) ? tr(`${what} che calano di più`, `Fastest-shrinking ${what.toLowerCase()}`) : tr(`${what} che crescono di meno`, `Slowest-growing ${what.toLowerCase()}`), rows: bottom.map(row) });
  };
  extremes(sorted(st, g), tr("Regioni", "Regions"));
  extremes(sorted(metros, g), tr("Province", "Provinces"));
  if (groups.length) rep.breakdown = { title: yrs ? tr(`Variazione dei residenti ${yrs[0]}–${yrs[1]}`, `Population change ${yrs[0]}–${yrs[1]}`) : tr("Variazione dei residenti", "Population change"), note: "", groups };

  rep.boards.modes = [
    { id: "abs", label: tr("Più popolose", "Largest"), states: rank(st, (o) => o.population), metros: rank(metros, (o) => o.population) },
    {
      id: "rel", label: tr("Crescita", "Growth"), hint: tr(`Variazione dei residenti${since}. Le città contano tutta la provincia.`, `Population change${since}. Cities count their whole province.`),
      states: rank(st, g, { fmt: (v) => signedPct(v, 2), exact: (v) => signedPct(v, 3) }), metros: rank(metros, g, { fmt: (v) => signedPct(v, 2), exact: (v) => signedPct(v, 3) }),
    },
  ];
}

function reportRate(rep, n, st, metros) {
  const u = (o) => o.employment_rate;
  const ss = sorted(st, u);
  if (ss.length >= 2) rep.context.push(tr(`Per regione: da ${pct(ss.at(-1).v)} (${ss.at(-1).r.name}) a ${pct(ss[0].v)} (${ss[0].r.name})`, `By region: from ${pct(ss.at(-1).v)} (${ss.at(-1).r.name}) to ${pct(ss[0].v)} (${ss[0].r.name})`));
  const tone = (v) => (!fin(n.employment_rate) || Math.abs(v / n.employment_rate - 1) < 0.03 ? null : v < n.employment_rate ? "bad" : "good");
  const row = (label, x) => ({ label: `${label}: ${x.r.name}`, sub: x.r.kind === "city" ? x.r.sub : "", value: x.v, text: pct(x.v), tone: tone(x.v) });
  const spread = (list) => (list.length >= 3 ? [row(tr("Più alto", "Highest"), list[0]), row(tr("Mediana", "Median"), list[Math.floor(list.length / 2)]), row(tr("Più basso", "Lowest"), list.at(-1))] : []);
  const groups = [];
  if (fin(n.employment_rate)) groups.push({ rows: [{ label: tr("Italia", "Italy"), value: n.employment_rate, text: pct(n.employment_rate), strong: true }] });
  const sRows = spread(ss), mRows = spread(sorted(metros, u));
  if (sRows.length) groups.push({ title: tr("Regioni", "Regions"), rows: sRows });
  if (mRows.length) groups.push({ title: tr("Province", "Provinces"), rows: mRows });
  if (groups.length) rep.breakdown = { title: tr("Distribuzione", "Spread"), note: "", groups };
  const o = { fmt: pct, exact: (v) => pct(v, 2) };
  rep.boards.modes = [
    { id: "abs", label: tr("Più alto", "Highest"), states: rank(st, u, o), metros: rank(metros, u, o) },
    { id: "rel", label: tr("Più basso", "Lowest"), states: rank(st, u, { ...o, asc: true }), metros: rank(metros, u, { ...o, asc: true }) },
  ];
}

function reportGold(rep, nation, n, st, metros) {
  const gold = (o) => o.yields?.gold ?? null;
  const pp = ratio(rep.total, n.population);
  if (pp != null) rep.context.push(tr(`${dollars(pp)} a persona all'anno (reddito 2019 ÷ residenti 2023)`, `${dollars(pp)} per person per year (2019 income ÷ 2023 residents)`));
  const perPerson = (o) => ratio(gold(o), o.population);
  const ss = sorted(st, perPerson);
  if (ss.length >= 2) rep.context.push(tr(`Per regione: da ${dollars(ss.at(-1).v)} (${ss.at(-1).r.name}) a ${dollars(ss[0].v)} (${ss[0].r.name})`, `By region: from ${dollars(ss.at(-1).v)} (${ss.at(-1).r.name}) to ${dollars(ss[0].v)} (${ss[0].r.name})`));
  rep.boards.modes = [
    { id: "abs", label: tr("Totale", "Total"), states: rank(st, gold, { fmt: money, exact: dollars }), metros: rank(metros, gold, { fmt: money, exact: dollars }) },
    {
      id: "rel", label: tr("A persona", "Per person"), hint: tr("Reddito disponibile pro capite (Prometeia 2019).", "Disposable income per person (Prometeia 2019)."),
      states: rank(st, perPerson, { fmt: dollars, exact: dollars }), metros: rank(metros, perPerson, { fmt: dollars, exact: dollars }),
    },
  ];
}

function reportCount(rep, def, nation, n, st, metros) {
  const key = def.key;
  const per1k = ratio(rep.total, n.population);
  if (per1k != null) rep.context.push(tr(`${comma((per1k * 1000).toFixed(per1k * 1000 < 10 ? 1 : 0))} ogni 1.000 residenti`, `${(per1k * 1000).toFixed(per1k * 1000 < 10 ? 1 : 0)} per 1,000 residents`));
  const y = (o) => o.yields?.[key];
  const per = (o) => { const r = ratio(y(o), o.population); return r == null ? null : r * 1000; };
  const ss = sorted(st, per);
  if (ss.length >= 2) rep.context.push(tr(`Ogni 1.000 residenti, per regione: da ${comma(ss.at(-1).v.toFixed(1))} (${ss.at(-1).r.name}) a ${comma(ss[0].v.toFixed(1))} (${ss[0].r.name})`, `Per 1,000 residents, by region: from ${ss.at(-1).v.toFixed(1)} (${ss.at(-1).r.name}) to ${ss[0].v.toFixed(1)} (${ss[0].r.name})`));
  const f1 = (v) => comma(v.toFixed(v < 10 ? 2 : 1));
  rep.boards.modes = [
    { id: "abs", label: tr("Totale", "Total"), states: rank(st, y), metros: rank(metros, y) },
    { id: "rel", label: tr("Ogni 1.000 abitanti", "Per 1,000 people"), hint: tr(`${def.label} ogni 1.000 residenti.`, `${def.label} per 1,000 residents.`), states: rank(st, per, { fmt: f1, exact: f1 }), metros: rank(metros, per, { fmt: f1, exact: f1 }) },
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// DOM

const defIcon = (def, size) => (def.yield ? glyph(def.yield, size) : icon(def.iconId, def.emoji, { size }));

function barsHtml(bd, expanded) {
  const all = bd.groups.flatMap((g) => g.rows);
  const max = Math.max(0, ...all.map((r) => Math.abs(r.value)));
  let shown = 0;
  const limit = bd.collapseAfter && !expanded ? bd.collapseAfter : Infinity;
  const groups = bd.groups
    .map((g) => {
      const rows = g.rows
        .filter(() => shown++ < limit)
        .map((r) => {
          const w = max > 0 ? (Math.abs(r.value) / max) * 100 : 0;
          const ic = r.iconId || r.emoji ? `<span class="yr-bic" aria-hidden="true">${icon(r.iconId, r.emoji, { size: 15 })}</span>` : "";
          const tip = [r.full || r.label, r.sub, r.text].filter(Boolean).join(" · ");
          return `<div class="yr-bar${r.strong ? " strong" : ""}${ic ? "" : " noic"}" title="${esc(tip)}">
            ${ic}<span class="yr-bl">${esc(r.label)}${r.sub ? ` <span class="muted">${esc(r.sub)}</span>` : ""}</span>
            <span class="yr-bv${r.tone ? " " + r.tone : ""}">${esc(r.text)}</span>
            <span class="yr-track"><i class="${r.tone || ""}" style="width:${w.toFixed(1)}%"></i></span></div>`;
        })
        .join("");
      if (!rows) return "";
      return `${g.title ? `<h4>${esc(g.title)}</h4>` : ""}${rows}`;
    })
    .join("");
  const more = bd.collapseAfter && all.length > bd.collapseAfter
    ? `<button class="yr-more" data-more aria-expanded="${expanded}">${expanded ? tr("Mostra meno", "Show fewer") : tr(`Mostra tutti (${all.length})`, `Show all ${all.length}`)}</button>` : "";
  return groups + more;
}

function boardHtml(rows) {
  if (!rows?.length) return `<p class="muted yr-empty">${tr("Nessun dato.", "No data.")}</p>`;
  const max = Math.max(0, ...rows.map((r) => Math.abs(r.value)));
  return `<ol class="yr-list">${rows
    .map((r) => {
      const w = max > 0 ? (Math.abs(r.value) / max) * 100 : 0;
      const tip = `${tr("Apri", "Open")} ${r.name}${r.exact && r.exact !== r.text ? ` (${r.exact})` : ""}`;
      return `<li><button class="yr-row" data-kind="${r.kind}" data-ref="${esc(r.ref)}" title="${esc(tip)}">
        <span class="yr-rk">${r.rank}</span>
        <span class="yr-nm">${esc(r.name)}${r.sub ? ` <span class="muted">${esc(r.sub)}</span>` : ""}</span>
        <span class="yr-v">${esc(r.text)}</span>
        <span class="yr-track"><i style="width:${w.toFixed(1)}%"></i></span></button></li>`;
    })
    .join("")}</ol>`;
}

/**
 * Wire the top-bar buttons (rendered by topbar.js with data-report="<key>") to the dropdown #yield-report.
 * opts: {nation, states, cities, lenses (array), lensVintage, onState(index), onCity(city), onLens(lensId)}
 */
export function initYieldReports(opts) {
  const bar = document.getElementById("yields");
  const pop = document.getElementById("yield-report");
  const none = { open() {}, close() {}, toggle() {}, get isOpen() { return false; }, build: () => null };
  if (!bar || !pop) return none;
  const data = { nation: opts.nation, states: opts.states, cities: opts.cities, lenses: opts.lenses, lensVintage: opts.lensVintage };
  const cityById = new Map((opts.cities || []).map((c) => [String(c.id), c]));
  const cache = new Map();
  const build = (key) => {
    if (!cache.has(key)) cache.set(key, buildReport(key, data));
    return cache.get(key);
  };
  let current = null; // {key, btn, rep}
  let tab = opts.states?.length ? "states" : "metros"; // remembered across reports
  let mode = "abs";
  let expanded = false;

  const buttons = () => [...bar.querySelectorAll("[data-report]")];
  const isMobile = () => matchMedia("(max-width: 700px)").matches;

  function position() {
    if (!current) return;
    const top = document.getElementById("topbar")?.getBoundingClientRect().bottom ?? 40;
    pop.style.top = Math.round(top) + (isMobile() ? 0 : 6) + "px";
    if (isMobile()) {
      pop.style.left = "";
      return;
    }
    const r = current.btn.getBoundingClientRect();
    const w = pop.offsetWidth || 440;
    const left = Math.max(8, Math.min(innerWidth - w - 8, r.left - 14));
    pop.style.left = Math.round(left) + "px";
  }

  function render() {
    const { rep } = current;
    const def = rep.def;
    const modes = rep.boards.modes;
    if (!modes.some((m) => m.id === mode)) mode = modes[0]?.id || "abs";
    const m = modes.find((x) => x.id === mode);
    const hasStates = modes.some((x) => x.states.length), hasMetros = modes.some((x) => x.metros.length);
    if (tab === "states" && !hasStates && hasMetros) tab = "metros";
    pop.style.setProperty("--yc", def.color || "var(--gold-bright)");
    pop.innerHTML = `
      <div class="yr-head">
        <span class="yr-ic" style="color:${esc(def.color)}">${defIcon(def, 26)}</span>
        <div class="yr-titles"><div class="yr-kind">${tr("Rapporto nazionale", "National report")}</div><h2 id="yr-title">${esc(def.name)}</h2></div>
        <button class="icon-btn yr-close" aria-label="${tr("Chiudi il rapporto (Esc)", "Close report (Esc)")}" title="${tr("Chiudi (Esc)", "Close (Esc)")}">${icon("close", "✕", { size: 12 })}</button>
      </div>
      <div class="yr-total"><b style="color:${esc(def.color)}">${esc(rep.totalText)}</b>
        ${rep.context.length ? `<ul class="yr-ctx">${rep.context.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}</div>
      ${rep.definition ? `<p class="yr-def">${esc(rep.definition)}</p>` : ""}
      ${rep.source ? `<div class="yr-src">${tr("Fonte", "Source")}: ${esc(rep.source)}</div>` : ""}
      ${rep.breakdown ? `<section class="yr-sec"><h3>${esc(rep.breakdown.title)}</h3>
        ${rep.breakdown.note ? `<p class="yr-note">${esc(rep.breakdown.note)}</p>` : ""}
        <div class="yr-bars">${barsHtml(rep.breakdown, expanded)}</div></section>` : ""}
      ${modes.length ? `<section class="yr-sec"><h3>${tr("Classifiche", "Leaderboards")}</h3>
        <div class="yr-controls">
          <div class="yr-tabs" role="tablist" aria-label="${tr("Aree", "Areas")}">
            <button role="tab" id="yr-tab-states" data-tab="states" aria-controls="yr-board" aria-selected="${tab === "states"}" tabindex="${tab === "states" ? 0 : -1}" ${hasStates ? "" : "disabled"}>${tr("Regioni", "Regions")}</button>
            <button role="tab" id="yr-tab-metros" data-tab="metros" aria-controls="yr-board" aria-selected="${tab === "metros"}" tabindex="${tab === "metros" ? 0 : -1}" ${hasMetros ? "" : "disabled"}>${tr("Città", "Cities")}</button>
          </div>
          ${modes.length > 1 ? `<div class="yr-modes" role="group" aria-label="${tr("Classifica", "Ranking")}">${modes
            .map((x) => `<button data-mode="${x.id}" aria-pressed="${x.id === mode}">${esc(x.label)}</button>`).join("")}</div>` : ""}
        </div>
        <p class="yr-note yr-hint">${esc(hintText(m))}</p>
        <div id="yr-board" role="tabpanel" aria-labelledby="yr-tab-${tab}">${boardHtml(m?.[tab])}</div></section>` : ""}
      ${rep.lens ? `<div class="yr-foot"><p class="yr-note yr-lens-note">${tr("Misura collegata, non questo totale", "Related measure, not this total")}: ${esc(rep.lens.unit || rep.lens.name)}${rep.lens.vintage ? ` (${esc(rep.lens.vintage)})` : ""}.</p>
        <button class="btn yr-lens" data-lens="${esc(rep.lens.id)}">${icon("layers", "🗺️", { size: 14 })}${tr(`Mappa collegata: lente ${esc(rep.lens.name)}`, `Related map: ${esc(rep.lens.name)} lens`)}</button></div>` : ""}
      ${advisorButtons(rep.key)}`;
  }

  // "Open advisor" buttons (ext/advisors): a full dashboard on the report's subject.
  function advisorButtons(key) {
    const list = advisorApp() ? ADVISOR_FOR[key] || [] : [];
    if (!list.length) return "";
    return `<div class="yr-foot yr-adv">${list.map((a) => `<button class="btn yr-advisor" data-advisor="${esc(a.id)}"${a.industry ? ` data-industry="${esc(a.industry)}"` : ""}
      title="${tr(`Apri il consigliere ${esc(a.label)}: grafici, tabelle e mappa collegati`, `Open the ${esc(a.label)} advisor: charts, tables and the map linked together`)}">${icon("g-people", "👥", { size: 14 })}${tr("Consigliere", "Advisor")}: ${esc(a.label)}</button>`).join("")}</div>`;
  }

  // The ranking's hint, plus (on the States tab) which states are ranked.
  function hintText(m) {
    const parts = [m?.hint || ""];
    if (tab === "states" && current.rep.boards.statesNote) parts.push(current.rep.boards.statesNote);
    return parts.filter(Boolean).join(" ");
  }

  // Re-render the leaderboard only (keeps focus on the control that changed it).
  function renderBoard() {
    const m = current.rep.boards.modes.find((x) => x.id === mode);
    pop.querySelectorAll("[data-tab]").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    pop.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    const hint = pop.querySelector(".yr-hint");
    if (hint) hint.textContent = hintText(m);
    const board = pop.querySelector("#yr-board");
    if (board) {
      board.setAttribute("aria-labelledby", `yr-tab-${tab}`);
      board.innerHTML = boardHtml(m?.[tab]);
    }
  }

  function open(key, btn) {
    const rep = build(key);
    if (!rep) return;
    if (current && current.btn !== btn) current.btn.setAttribute("aria-expanded", "false");
    if (!current || current.key !== key) {
      expanded = false;
      mode = "abs"; // each report opens on its main ranking; the States / Metros tab is remembered
    }
    current = { key, btn, rep };
    for (const b of buttons()) b.classList.toggle("open", b === btn);
    btn.setAttribute("aria-expanded", "true");
    pop.setAttribute("aria-labelledby", "yr-title");
    render();
    pop.hidden = false;
    pop.scrollTop = 0;
    position();
    // Keep the anchor visible when the bar has scrolled (narrow screens).
    btn.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    pop.focus({ preventScroll: true });
  }

  function close(restoreFocus = true) {
    if (!current) return;
    const { btn } = current;
    btn.setAttribute("aria-expanded", "false");
    btn.classList.remove("open");
    current = null;
    pop.hidden = true;
    pop.innerHTML = "";
    if (restoreFocus && document.contains(btn)) btn.focus();
  }

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-report]");
    if (!btn) return;
    if (current?.btn === btn) close();
    else open(btn.dataset.report, btn);
  });

  pop.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !current) return;
    if (t.classList.contains("yr-close")) return close();
    if (t.dataset.tab) {
      tab = t.dataset.tab;
      return renderBoard();
    }
    if (t.dataset.mode) {
      mode = t.dataset.mode;
      return renderBoard();
    }
    if (t.hasAttribute("data-more")) {
      expanded = !expanded;
      const bars = pop.querySelector(".yr-bars");
      if (bars) bars.innerHTML = barsHtml(current.rep.breakdown, expanded);
      pop.querySelector("[data-more]")?.focus();
      return;
    }
    if (t.dataset.advisor) {
      const app = advisorApp();
      const params = { id: t.dataset.advisor, ...(t.dataset.industry ? { industry: t.dataset.industry } : {}) };
      close(false);
      return app?.setMode("advisor", params);
    }
    if (t.dataset.lens) {
      const id = t.dataset.lens;
      close();
      return opts.onLens?.(id);
    }
    if (t.dataset.kind === "state") {
      close(false);
      return opts.onState?.(Number(t.dataset.ref));
    }
    if (t.dataset.kind === "city") {
      const city = cityById.get(t.dataset.ref);
      if (!city) return close();
      close(false);
      return opts.onCity?.(city);
    }
  });

  // The report is a non-modal popover that logically follows its stat button: Shift+Tab from its first control
  // goes back to the button, Tab past its last control closes it and moves on to whatever follows the button.
  const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
  const visible = (el) => el.getClientRects().length > 0 && !el.closest("[hidden]");
  pop.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey || !current) return;
    const inside = [...pop.querySelectorAll(FOCUSABLE)].filter(visible);
    const first = inside[0], last = inside.at(-1);
    if (e.shiftKey && (e.target === pop || e.target === first)) {
      e.preventDefault();
      current.btn.focus();
    } else if (!e.shiftKey && (e.target === last || !inside.length)) {
      const all = [...document.querySelectorAll(FOCUSABLE)].filter((el) => visible(el) && !pop.contains(el));
      const next = all[all.indexOf(current.btn) + 1];
      e.preventDefault();
      close(!next);
      next?.focus();
    }
  });
  // From the button, Tab goes into the open report rather than to the next stat.
  bar.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || !current || e.target !== current.btn) return;
    const first = [...pop.querySelectorAll(FOCUSABLE)].find(visible);
    if (!first) return;
    e.preventDefault();
    first.focus();
  });
  // Focus moving anywhere else (search via "/" or Cmd+K, the share button, Tab elsewhere) closes the report, so
  // only one popover is ever open.
  document.addEventListener("focusin", (e) => {
    if (current && !pop.contains(e.target) && e.target !== current.btn) close(false);
  });

  // Tabs: arrow keys move between them (WAI-ARIA tabs pattern).
  pop.addEventListener("keydown", (e) => {
    const t = e.target.closest?.("[role=tab]");
    if (!t || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const tabs = [...pop.querySelectorAll("[role=tab]:not([disabled])")];
    let i = tabs.indexOf(t);
    if (i < 0 || tabs.length < 2) return;
    i = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    e.preventDefault();
    tab = tabs[i].dataset.tab;
    renderBoard();
    tabs[i].focus();
  });

  document.addEventListener("pointerdown", (e) => {
    if (current && !pop.contains(e.target) && !e.target.closest?.("[data-report]")) close(false);
  });
  window.addEventListener("resize", position);
  bar.addEventListener("scroll", position, { passive: true });
  document.getElementById("topbar")?.addEventListener("scroll", position, { passive: true });

  return {
    open(key) {
      const btn = buttons().find((b) => b.dataset.report === key);
      if (btn) open(key, btn);
    },
    close,
    toggle(key) {
      if (current?.key === key) close();
      else this.open(key);
    },
    build,
    get isOpen() { return !!current; },
    get key() { return current?.key ?? null; },
  };
}
