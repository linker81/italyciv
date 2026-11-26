// The city screen: a docked dashboard (a bottom sheet on phones) with the header (and its city-type badge),
// Citizens (figure rows from citizens.json), Districts (districts.json + military.json), Economy, Workforce,
// Resources and Compare. Plain HTML strings + inline SVG charts; render(el, model, handlers) fills `el`. The
// citizens and districts files load on demand (h.loadData) and fill their sections when they arrive.
import { DEC, locale, t as tr } from "../../i18n.js";
import { dollars, esc, int, pct } from "../../format.js";
import { compact, money, popShort, yieldValue } from "./fmt.js";
import { icon, glyph } from "../../ui/icon.js";
import { css } from "../../color.js";
import { isCapital } from "../../world.js";
import { sparkline, meter, bar } from "./charts.js";
import { popSeries, rankCount, resourceValue, LAND } from "./model.js";
import { citizensHtml, mountCitizens } from "./citizens.js";

const TABS = [
  ["citizens", tr("Abitanti", "Citizens"), "pop"],
  ["yields", tr("Rese", "Yields"), "y-gold"],
  ["indicators", tr("Indicatori", "Indicators"), "layers"],
  ["resources", tr("Risorse", "Resources"), "resources"],
  ["compare", tr("Confronta", "Compare"), "l-people"],
];

const dec = (v, d = 1) => (v == null ? "–" : v.toFixed(d).replace(".", DEC));
const signed = (g, d = 1) => (g == null ? "–" : `${g >= 0 ? "+" : "−"}${dec(Math.abs(g * 100), d)}%`);
const rankCache = new WeakMap();
function countOf(cities, key) {
  let m = rankCache.get(cities);
  if (!m) rankCache.set(cities, (m = new Map()));
  if (!m.has(key)) m.set(key, rankCount(cities, key));
  return m.get(key);
}

function rankBadge(rank, of, label, tip) {
  if (rank == null) return "";
  const tier = rank <= 10 ? "gold" : rank <= 30 ? "silver" : "bronze";
  return `<div class="cv-rank ${tier}" title="${esc(tip || tr(`${label}: ${rank}ª su ${of} province (1 = la più alta)`, `${label}: #${rank} of ${of} provinces (1 = highest)`))}">
    <span class="cv-medal">${tr(`${rank}ª`, `#${rank}`)}</span><span class="cv-rank-l">${esc(label)}</span></div>`;
}

// --- header --------------------------------------------------------------------------------------------------------
function header(m) {
  const c = m.city, n = m.nation.nation;
  const cities = m.cityList;
  const col = css(m.stateRGB);
  const chips = m.states.map((s) => (s.index >= 0
    ? `<button class="chip" data-state="${s.index}" title="${tr("Apri", "Open")} ${esc(s.name)}">${esc(s.name)}</button>`
    : `<span class="chip">${esc(s.abbr)}</span>`)).join("");
  const g = Number.isFinite(c.growth) ? c.growth : null;
  const yrs = Array.isArray(c.growth_years) ? c.growth_years : null;
  const growth = g == null ? "" : `<span class="cv-growth ${g >= 0 ? "good" : "bad"}" title="${tr(`Variazione dei residenti ${yrs ? `${yrs[0]}–${yrs[1]}` : ""} (ISTAT, 1° gennaio). Italia: ${signed(n.growth, 2)}`, `Population change ${yrs ? `${yrs[0]}–${yrs[1]}` : ""} (ISTAT, 1 January). Italy: ${signed(n.growth, 2)}`)}">${g >= 0 ? "▲" : "▼"} ${dec(Math.abs(g * 100), 2)}%${yrs ? ` <small>${tr("dal", "since")} ${yrs[0]}</small>` : ""}</span>`;
  const r = c.ranks || {};
  const N = (k) => countOf(cities, k);
  return `
  <div class="sheet-grip cv-grip" aria-hidden="true"></div>
  <header class="cv-head" style="--sc:${col}">
    <div class="cv-ribbon" aria-hidden="true"></div>
    <button class="icon-btn cv-close" data-close aria-label="${tr("Chiudi la vista città (Esc)", "Close the City View (Esc)")}" title="${tr("Torna alla mappa (Esc)", "Back to the map (Esc)")}">${icon("close", "✕", { size: 13 })}</button>
    <div class="cv-kind">${tr("Vista città", "City View")} · ${c.metro ? tr("Città metropolitana", "Metropolitan city") : tr("Provincia", "Province")}</div>
    <div class="cv-title">
      <div class="cv-crest" aria-hidden="true"><span>${esc(popShort(c.population))}</span></div>
      <div class="cv-tt">
        <h2 class="cv-name" tabindex="-1">${isCapital(c) ? `<span class="cv-cap" title="${tr("Capitale", "Capital")}">★</span> ` : ""}${esc(c.name)}</h2>
        <div class="cv-full">${esc(c.full || "")}${c.capoluogo_population ? tr(` · comune capoluogo: ${int(c.capoluogo_population)} abitanti`, ` · capital municipality: ${int(c.capoluogo_population)} people`) : ""}</div>
        <div class="cv-typeslot" data-ctype></div>
        ${chips ? `<div class="chips">${chips}</div>` : ""}
      </div>
    </div>
    <div class="cv-headline">
      <div class="cv-big"><span class="lbl">${icon("pop", "👥", { size: 13 })} ${tr("Popolazione", "Population")}</span><b>${int(c.population)}</b>${growth}</div>
      <div class="cv-big"><span class="lbl">${icon("y-gold", "💰", { size: 13 })} ${tr("Reddito disponibile", "Disposable income")}</span><b>${money(c.yields?.gold)}</b>${
        c.median_income != null ? `<span class="cv-sub">${dollars(c.median_income)} ${tr("a persona", "per person")}</span>` : ""}</div>
    </div>
    <div class="cv-ranks" aria-label="${tr(`Posizione tra ${cities.length} province`, `Ranks among ${cities.length} provinces`)}">
      ${rankBadge(r.population, N("population"), tr("Popolazione", "Population"))}
      ${rankBadge(r.gold, N("gold"), tr("Reddito totale", "Total income"))}
      ${rankBadge(r.gdp_per_capita, N("gdp_per_capita"), tr("Reddito a persona", "Income per person"))}
      ${rankBadge(r.growth, N("growth"), tr("Crescita", "Growth"), r.growth != null ? tr(`Crescita: ${r.growth}ª su ${N("growth")} (1 = la più veloce)`, `Growth: #${r.growth} of ${N("growth")} (1 = fastest)`) : "")}
    </div>
  </header>
  <nav class="cv-tabs" aria-label="${tr("Sezioni della vista città", "City View sections")}">
    ${TABS.map(([id, label, ic]) => `<button type="button" data-tab="${id}">${icon(ic, "•", { size: 14 })}<span>${label}</span></button>`).join("")}
  </nav>`;
}

// --- citizens ------------------------------------------------------------------------------------------------------
function citizens(m) {
  const c = m.city, n = m.nation.nation;
  const row = (ic, fb, label, v, us, fmt, better, max, sub = us != null ? `${tr("Italia", "Italy")} ${fmt(us)}` : "", tick = us) => `
    <div class="cv-stat">
      <div class="cv-stat-top"><span class="sl">${icon(ic, fb, { size: 14 })}${esc(label)}</span>
        <span class="sv"><b>${v == null ? "–" : fmt(v)}</b>${sub ? `<small>${sub}</small>` : ""}</span></div>
      ${meter(v, tick, max ?? Math.max(v || 0, us || 0) * 1.35, better)}
    </div>`;
  const multi = m.tiles.length > 1;
  const tilesNote = multi
    ? tr(`Sulla mappa ogni esagono della provincia mostra <b>≈ residenti</b> (densità × superficie dell'esagono, una stima) e il suo
       <b>uso del suolo</b> principale (stimato dal rilievo: vedi l'Almanacco)${m.residentsSum > 0
        ? `. Insieme i ${m.tiles.length} esagoni contano circa ${compact(m.residentsSum)} persone secondo questa stima` : ""}.`,
      `On the map each hex of the province shows <b>≈ residents</b> (density × hex area, an estimate) and its
       <b>main land use</b> (estimated from relief: see the Almanac)${m.residentsSum > 0
        ? `. Together the ${m.tiles.length} hexes hold about ${compact(m.residentsSum)} people by that estimate` : ""}.`)
    : tr(`Questa provincia sta in un solo esagono (circa ${compact(m.hexArea)} km²), mostrato con la sua città.`, `This province fits inside one hex (about ${compact(m.hexArea)} km²), shown with its city.`);
  return `
  <section class="cv-sec" id="cv-citizens" data-sec="citizens" aria-labelledby="cv-h-citizens">
    <h3 id="cv-h-citizens">${icon("pop", "👥", { size: 15 })}${tr("Abitanti", "Citizens")}</h3>
    <div class="cv-citizens" data-citizens>${citizensHtml(m, undefined)}</div>
    <div class="cv-stats">
      ${row("unemployment", "🏭", tr("Tasso di occupazione (15-64)", "Employment rate (15-64)"), c.employment_rate, n.employment_rate, (x) => pct(x), "high", 1)}
      ${row("l-income", "💶", tr("Reddito disponibile pro capite", "Disposable income per person"), c.median_income, n.median_income, dollars, "high")}
      ${row("l-homeownership", "🔑", tr("Affitto 100 m² nel capoluogo, al mese", "Rent of 100 m² in the capital, per month"), c.median_rent, n.median_rent, dollars, null)}
      ${row("l-home", "🏠", tr("Prezzo case nel capoluogo, €/m²", "Home prices in the capital, €/m²"), c.home_value, n.home_value, dollars, null)}
      ${row("l-age", "🎂", tr("Età mediana", "Median age"), c.median_age, n.median_age, (x) => dec(x) + tr(" anni", " yrs"), null, 60)}
    </div>
    <div class="cv-legend-tiles">${tileLegend(m)}<p>${tilesNote}</p></div>
  </section>`;
}

function tileLegend(m) {
  const counts = new Map();
  for (const t of m.tiles) if (t.land) counts.set(t.land.key, (counts.get(t.land.key) || 0) + 1);
  return `<div class="cv-tl">${LAND.filter((g) => counts.has(g.key)).map((g) =>
    `<span class="cv-tl-i"><i style="background:${esc(m.landColor(g.key))}"></i>${esc(g.label)} <small>${counts.get(g.key)}</small></span>`).join("")}</div>`;
}

// --- yields --------------------------------------------------------------------------------------------------------
function yieldsSec(m) {
  const c = m.city, nat = m.nation, n = nat.nation;
  const r = c.ranks || {};
  const cities = m.cityList;
  const tiles = nat.yields.map((y) => {
    const v = c.yields?.[y.key];
    const rk = r[y.key];
    const per = v != null && c.population ? (v / c.population) * 1000 : null;
    const nper = n.yields?.[y.key] != null && n.population ? (n.yields[y.key] / n.population) * 1000 : null;
    const perTxt = y.unit === "usd" ? (per != null ? `${dollars(per / 1000)} ${tr("a persona", "per person")}` : "") : per != null ? `${dec(per, per < 10 ? 2 : 1)} ${tr("ogni 1.000 ab.", "per 1,000 people")}` : "";
    const nTxt = y.unit === "usd" ? (nper != null ? `${tr("Italia", "Italy")} ${dollars(nper / 1000)}` : "") : nper != null ? `${tr("Italia", "Italy")} ${dec(nper, nper < 10 ? 2 : 1)}` : "";
    return `<div class="cv-yield" style="--yc:${esc(y.color)}" title="${esc(y.label)}: ${esc(y.description || "")}">
      <div class="ico">${glyph(y, 20)}</div><div class="val">${yieldValue(y, v)}</div>
      <div class="lbl">${esc(y.label)}</div>
      ${rk != null ? `<div class="rk">${tr(`${rk}ª`, `#${rk}`)} <small>${tr("su", "of")} ${countOf(cities, y.key)}</small></div>` : ""}
      ${perTxt ? `<div class="rk"><small>${esc(perTxt)}<br>${esc(nTxt)}</small></div>` : ""}</div>`;
  }).join("");
  return `
  <section class="cv-sec" id="cv-yields" data-sec="yields" aria-labelledby="cv-h-yields">
    <h3 id="cv-h-yields">${icon("y-gold", "💰", { size: 15 })}${tr("Rese", "Yields")}</h3>
    <div class="cv-yields">${tiles}</div>
    <p class="cv-note">${tr(`Posizione tra le ${cities.length} province. Ogni resa è un conteggio reale costruito da un tasso provinciale
    per la popolazione: l'Almanacco (pagina «Rese») spiega quale.`, `Rank among the ${cities.length} provinces. Each yield is a real count built from a provincial rate times the population: the Almanac (page “Yields”) says which.`)}</p>
  </section>`;
}

// --- indicators (counties.json row of the province) ----------------------------------------------------------------
const IND_GROUPS = [
  [tr("Lavoro e ricchezza", "Work and wealth"), ["employment", "gender_gap", "export", "deposits", "pension", "rdc"]],
  [tr("Conoscenza", "Knowledge"), ["bachelors", "neet", "lifelong", "broadband", "startups", "libraries", "bookshops"]],
  [tr("Vita quotidiana", "Daily life"), ["culture", "box_office", "restaurants", "bars", "cars", "road_casualties", "turnout"]],
  [tr("Salute, sicurezza, ambiente", "Health, safety, environment"), ["gps", "nurses", "antidepressants", "crime", "court_days", "eco_urban", "climate_risk"]],
  [tr("Popolazione", "Population"), ["density", "elderly", "old_age", "births"]],
];

function fmtField(f, v) {
  if (v == null || !Number.isFinite(v)) return "–";
  if (f.format === "pct") return pct(v, v < 0.1 ? 1 : 0);
  if (f.format === "usd") return dollars(v);
  if (f.format === "int") return int(v);
  return dec(v, Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0);
}

export function indicatorsHtml(m, data) {
  if (data === undefined) return `<p class="muted cv-note">${tr("Carico gli indicatori…", "Loading the indicators…")}</p>`;
  if (!data || !Array.isArray(data.rows)) return `<p class="muted cv-note">${tr("Indicatori non disponibili.", "Indicators not available.")}</p>`;
  const col = Object.fromEntries(data.columns.map((k, j) => [k, j]));
  const field = Object.fromEntries(data.fields.map((f) => [f.key, f]));
  const geo = m.city.counties?.[0] ?? m.city.province;
  const row = data.rows.find((r) => r[col.geoid] === geo);
  if (!row) return `<p class="muted cv-note">${tr("Nessun dato per questa provincia.", "No data for this province.")}</p>`;
  const popJ = col.population;
  // Italy = population-weighted mean of the provinces; rank among the 107.
  const stat = (k) => {
    const j = col[k];
    let num = 0, den = 0;
    const vals = [];
    for (const r of data.rows) {
      const v = r[j];
      if (v == null || !Number.isFinite(v)) continue;
      num += v * (r[popJ] || 0);
      den += r[popJ] || 0;
      vals.push(v);
    }
    vals.sort((a, b) => b - a);
    const v = row[j];
    return { v, it: den ? num / den : null, rank: v != null ? vals.indexOf(v) + 1 : null, of: vals.length };
  };
  return IND_GROUPS.map(([title, keys]) => {
    const rows = keys.filter((k) => col[k] != null).map((k) => {
      const f = field[k];
      const s = stat(k);
      const better = f.higher_is === "good" ? s.v >= s.it : f.higher_is === "bad" ? s.v <= s.it : null;
      const cls = s.v == null || s.it == null || better == null || Math.abs(s.v / s.it - 1) < 0.03 ? "" : better ? "good" : "bad";
      return `<div class="cv-stat" title="${esc(f.description || "")}">
        <div class="cv-stat-top"><span class="sl">${esc(f.label)}${f.unit ? ` <small class="muted">${esc(f.unit)}</small>` : ""}</span>
          <span class="sv"><b class="${cls}">${fmtField(f, s.v)}</b><small>${tr("Italia", "Italy")} ${fmtField(f, s.it)}${s.rank ? tr(` · ${s.rank}ª su ${s.of}`, ` · #${s.rank} of ${s.of}`) : ""}</small></span></div>
      </div>`;
    }).join("");
    return `<h4 class="cv-h4">${esc(title)}</h4><div class="cv-stats">${rows}</div>`;
  }).join("") + `<p class="cv-note">${tr("Il Sole 24 Ore, Qualità della vita 2020 (dati 2019-2020, varie fonti) e ISTAT 2023. «Italia» è la media delle province pesata per popolazione; la posizione è tra le province (1 = valore più alto). Passa sopra un indicatore per la sua definizione e fonte.", "Il Sole 24 Ore, Qualità della vita 2020 (2019-2020 data, various sources) and ISTAT 2023. “Italy” is the population-weighted mean of the provinces; the rank is among the provinces (1 = highest value). Hover an indicator for its definition and source.")}</p>`;
}

function indicators() {
  return `
  <section class="cv-sec" id="cv-indicators" data-sec="indicators" aria-labelledby="cv-h-indicators">
    <h3 id="cv-h-indicators">${icon("layers", "▤", { size: 15 })}${tr("Indicatori della provincia", "Province indicators")}</h3>
    <div data-indicators>${indicatorsHtml(null, undefined)}</div>
  </section>`;
}

// --- resources -----------------------------------------------------------------------------------------------------
function resources(m) {
  const list = m.sites.map((s, k) => {
    const t = s.type;
    const val = resourceValue(s.item, t, compact);
    return `<button type="button" class="cv-site" data-site="${k}" title="${tr("Vai a", "Fly to")} ${esc(s.item.name)}">
      <span class="cv-med" style="--bg:${esc(t?.color || "#3a4a5e")}">${glyph(t, 16)}</span>
      <span class="cv-site-t"><b>${esc(s.item.name)}</b><small>${esc(t?.name || s.item.type)}</small>
        ${s.item.detail ? `<small class="cv-site-d">${esc(s.item.detail)}</small>` : ""}</span>
      <span class="cv-site-v">${esc(val)}<i aria-hidden="true">›</i></span>
    </button>`;
  }).join("");
  const mw = m.sites.filter((s) => s.type?.unit === "MW").reduce((a, s) => a + (s.item.value || 0), 0);
  const summary = m.sites.length
    ? `<p class="cv-lead">${m.sites.length} ${m.sites.length === 1 ? tr("impianto", "site") : tr("impianti", "sites")} ${tr("sulla mappa", "on the map")}${
      mw ? ` · ${mw >= 1000 ? `${dec(mw / 1000)} GW` : `${Math.round(mw)} MW`} ${tr("di potenza", "of capacity")}` : ""}. ${tr("Clicca per andarci.", "Click one to fly there.")}</p>`
    : `<p class="muted cv-note">${tr("Nessun impianto sulla mappa in questa provincia. Sono mappati solo gli impianti grandi (ogni tipo ha una soglia).", "No mapped sites in this province. Only large sites are mapped (each type has a size threshold).")}</p>`;
  return `
  <section class="cv-sec" id="cv-resources" data-sec="resources" aria-labelledby="cv-h-resources">
    <h3 id="cv-h-resources">${icon("resources", "⛏️", { size: 15 })}${tr("Risorse", "Resources")}</h3>
    ${summary}
    <div class="cv-sites">${list}</div>
    ${m.sites.length ? `<p class="cv-note">${tr("Impianti il cui esagono è nella provincia. Solo quelli mappati, non tutta la potenza installata.", "Sites whose hex lies in the province. Mapped sites only, not the province's full capacity.")}</p>` : ""}
  </section>`;
}

// --- compare -------------------------------------------------------------------------------------------------------
const COMPARE = {
  size: [
    [tr("Popolazione", "Population"), (c) => c.population, (v) => popShort(v)],
    [tr("Reddito pro capite", "Income per person"), (c) => c.median_income, dollars],
    [tr("Crescita", "Growth"), (c) => (Number.isFinite(c.growth) ? c.growth : null), (v) => signed(v, 2)],
    [tr("Età mediana", "Median age"), (c) => c.median_age, (v) => dec(v)],
  ],
  housing: [
    [tr("Prezzo €/m²", "Price €/m²"), (c) => c.home_value, dollars],
    [tr("Affitto / mese", "Rent / month"), (c) => c.median_rent, dollars],
    [tr("Occupazione", "Employment"), (c) => c.employment_rate, (v) => pct(v, 0)],
    [tr("Diplomati", "Diploma holders"), (c) => c.bachelors, (v) => pct(v, 0)],
  ],
};

export function compareTable(m, set = "size") {
  const rows = [m.city, ...m.peers];
  const cols = COMPARE[set] || COMPARE.size;
  const max = cols.map(([, f]) => Math.max(...rows.map((c) => Math.abs(f(c) ?? 0))) || 1);
  return `<div class="cv-cmp" role="table" aria-label="${esc(m.city.name)} ${tr("e le province simili", "and its peers")}">
    <div class="cv-cmp-r cv-cmp-h" role="row"><span role="columnheader">${tr("Città", "City")}</span>${cols.map(([l]) => `<span role="columnheader">${esc(l)}</span>`).join("")}</div>
    ${rows.map((c, k) => `<div class="cv-cmp-r${k === 0 ? " me" : ""}" role="row">
      <span role="cell">${k === 0 ? `<b class="cv-cmp-n">${esc(c.name)}</b>` : `<button type="button" class="cv-cmp-n" data-peer="${esc(c.id)}" title="${tr(`Apri ${esc(c.full || c.name)} nella vista città`, `Open ${esc(c.full || c.name)} in the City View`)}">${esc(c.name)}</button>`}<small>${esc((c.states || []).join("–"))}</small></span>
      ${cols.map(([, f, fmt], j) => {
        const v = f(c);
        const col = v != null && v < 0 ? "#f08a6a" : k === 0 ? "#ecd08e" : "#8fa6bd";
        return `<span role="cell"><em>${v == null ? "–" : esc(fmt(v))}</em>${bar(v == null ? 0 : Math.abs(v) / max[j], col)}</span>`;
      }).join("")}
    </div>`).join("")}
  </div>`;
}

function compare(m) {
  return `
  <section class="cv-sec" id="cv-compare" data-sec="compare" aria-labelledby="cv-h-compare">
    <h3 id="cv-h-compare">${icon("l-people", "⚖️", { size: 15 })}${tr("Confronta", "Compare")}</h3>
    <p class="cv-lead">${tr(`Le ${m.peers.length} province più simili per popolazione. Clicca per aprirne una.`, `The ${m.peers.length} provinces closest in population. Click one to open it.`)}</p>
    <div class="cv-seg" role="group" aria-label="${tr("Misure", "Metrics")}">
      <button type="button" data-set="size" aria-pressed="true">${tr("Dimensione e reddito", "Size &amp; income")}</button>
      <button type="button" data-set="housing" aria-pressed="false">${tr("Casa e lavoro", "Housing &amp; jobs")}</button>
    </div>
    <div data-compare>${compareTable(m, "size")}</div>
  </section>`;
}

function footer(m) {
  const nat = m.nation;
  return `<div class="cv-foot">${tr(`Fonti: ${esc(nat.vintage)}; centrali WRI Global Power Plant Database. Le posizioni sono tra le
    ${m.cityList.length} province (ogni «città» è la provincia del suo capoluogo).`, `Sources: ${esc(nat.vintage)}; power plants from the WRI Global Power Plant Database. Ranks are among the ${m.cityList.length} provinces (each “city” is its capital's province).`)}
    <a href="#" data-pedia>${tr("Almanacco", "Almanac")} ›</a></div>`;
}

/**
 * Fill the dock. handlers: {onClose, onState(idx), onPeer(id), onSite(site), onSiteHover(site|null), onPedia,
 * loadCounties() → Promise<counties.json|null>, loadData(name) → Promise<data|null>, onDistricts(list)} (the
 * metro's districts once districts.json is in, for the map plaques).
 */
/**
 * Scrolls the dock to a section (its tab id, e.g. "districts"). Citizens and districts arrive later and change the
 * heights above, so the section is re-aligned as they do, for up to 4 s or until the user scrolls themselves.
 */
export function goToSection(el, id) {
  const sec = el?.querySelector(`[data-sec="${id}"]`);
  if (!sec) return false;
  const align = () => {
    const nav = el.querySelector(".cv-tabs");
    el.scrollTop = Math.max(0, sec.offsetTop - (nav?.offsetHeight || 0) - 4);
    el.onscroll?.(); // the tab spy (a scroll event is not always sent for a programmatic jump)
  };
  align();
  let ro = null;
  const stop = () => {
    ro?.disconnect();
    ro = null;
    for (const t of ["wheel", "touchstart", "keydown", "pointerdown"]) el.removeEventListener(t, stop);
  };
  for (const t of ["wheel", "touchstart", "keydown", "pointerdown"]) el.addEventListener(t, stop, { passive: true });
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(() => { if (sec.isConnected) align(); else stop(); });
    for (const c of el.children) ro.observe(c);
  }
  setTimeout(stop, 4000);
  return true;
}

export function render(el, m, h) {
  el.classList.add("cv-dock");
  el.style.setProperty("--sc", css(m.stateRGB));
  el.innerHTML = header(m) + citizens(m) + yieldsSec(m) + indicators(m) + resources(m) + compare(m) + footer(m);
  el.scrollTop = 0;

  el.querySelector("[data-close]").onclick = () => h.onClose();
  el.querySelectorAll("[data-state]").forEach((b) => (b.onclick = () => h.onState(+b.dataset.state)));
  el.querySelector("[data-pedia]").onclick = (e) => { e.preventDefault(); h.onPedia(); };

  // Sites: hover lights the hex on the map, click flies there.
  el.querySelectorAll("[data-site]").forEach((b) => {
    const s = m.sites[+b.dataset.site];
    b.onclick = () => h.onSite(s);
    b.onmouseenter = b.onfocus = () => h.onSiteHover(s);
    b.onmouseleave = b.onblur = () => h.onSiteHover(null);
  });

  // Compare: metric sets and peer links (delegated, the table is re-rendered).
  const cmp = el.querySelector("[data-compare]");
  el.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => {
    el.querySelectorAll("[data-set]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    cmp.innerHTML = compareTable(m, b.dataset.set);
  }));
  cmp.addEventListener("click", (e) => {
    const b = e.target.closest("[data-peer]");
    if (b) h.onPeer(b.dataset.peer);
  });

  // Tabs scroll to their section; the active tab follows the scroll position.
  const nav = el.querySelector(".cv-tabs");
  const tabs = [...el.querySelectorAll("[data-tab]")];
  const secs = tabs.map((t) => el.querySelector(`[data-sec="${t.dataset.tab}"]`));
  tabs.forEach((t, k) => (t.onclick = () => {
    const top = secs[k].offsetTop - nav.offsetHeight - 4;
    el.scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }));
  const spy = () => {
    const y = el.scrollTop + nav.offsetHeight + 24;
    let k = 0;
    secs.forEach((s, j) => { if (s.offsetTop <= y) k = j; });
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) k = secs.length - 1;
    tabs.forEach((t, j) => t.classList.toggle("on", j === k));
  };
  el.onscroll = spy;
  spy();

  // Citizens and districts arrive with their files (each loaded once, on demand).
  const czHost = el.querySelector("[data-citizens]");
  Promise.resolve(h.loadData?.("citizens")).then((data) => {
    if (!czHost.isConnected) return;
    czHost.innerHTML = citizensHtml(m, data ?? null);
    mountCitizens(czHost, m, data);
  }, () => { if (czHost.isConnected) czHost.innerHTML = citizensHtml(m, null); });
  h.onDistricts?.([]);

  // The province's indicators arrive with counties.json (loaded once, on demand).
  const host = el.querySelector("[data-indicators]");
  Promise.resolve(h.loadCounties()).then((data) => {
    if (host.isConnected) host.innerHTML = indicatorsHtml(m, data);
  }, () => { if (host.isConnected) host.innerHTML = indicatorsHtml(m, null); });
}
