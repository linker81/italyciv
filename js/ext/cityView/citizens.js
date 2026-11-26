// City View "Citizens" rows: the metro's people as rows of small figures (citizens.json, ACS 1-year).
//
//   citizensHtml(m, data) → HTML      the rows (placeholders for the figure canvases)
//   mountCitizens(host, m, data)       paints the figures and wires the hover / focus read-out
//
// Each row: N figures (workforce 20, ages 10, commute 10 from the file; education and origins 10, rounded here with
// the same largest-remainder method), a caption ("each figure ≈ 72K workers"), a read-out line that a hovered or
// focused figure fills ("1 in 7 workers in San Jose is an engineer, coder or scientist (US: 1 in 14)"), and a thin
// U.S. bar for comparison. A row Census left out is said so, never drawn as zeros.
import { DEC, locale, EN, t as tr } from "../../i18n.js";
import { esc, int, pct } from "../../format.js";
import { compact } from "./fmt.js";
import { CATEGORY_COLOR, figureCanvas, loadPainter } from "./figures.js";

const ROWS_IT = [
  { id: "age", title: "Generazioni", sub: "per età", noun: ["residente", "residenti"], n: null },
  { id: "education", title: "Istruzione", sub: "25-64 anni", noun: ["adulto", "adulti di 25-64 anni"], n: 10 },
];

// [singular, plural] predicate per category, for "1 su 7 residenti di X …" / "7 su 10 … sono …".
const PHRASE_IT = {
  age: {
    child: ["ha meno di 18 anni", "hanno meno di 18 anni"],
    young: ["ha tra 18 e 34 anni", "hanno tra 18 e 34 anni"],
    midlife: ["ha tra 35 e 64 anni", "hanno tra 35 e 64 anni"],
    elder: ["ha 65 anni o più", "hanno 65 anni o più"],
  },
  education: {
    less_than_hs: ["non ha il diploma", "non hanno il diploma"],
    high_school: ["ha almeno il diploma", "hanno almeno il diploma"],
  },
};

// Short legend labels.
const SHORT_IT = {
  age: { child: "Sotto i 18", young: "18–34", midlife: "35–64", elder: "65+" },
  education: { less_than_hs: "Senza diploma", high_school: "Diploma o più" },
};

const ROWS_EN = [
  { id: "age", title: "Generations", sub: "by age", noun: ["resident", "residents"], n: null },
  { id: "education", title: "Education", sub: "aged 25-64", noun: ["adult", "adults aged 25-64"], n: 10 },
];
const PHRASE_EN = {
  age: {
    child: ["is under 18", "are under 18"],
    young: ["is 18–34", "are 18–34"],
    midlife: ["is 35–64", "are 35–64"],
    elder: ["is 65 or older", "are 65 or older"],
  },
  education: {
    less_than_hs: ["has no upper-secondary diploma", "have no upper-secondary diploma"],
    high_school: ["has at least an upper-secondary diploma", "have at least an upper-secondary diploma"],
  },
};
const SHORT_EN = {
  age: { child: "Under 18", young: "18–34", midlife: "35–64", elder: "65+" },
  education: { less_than_hs: "No diploma", high_school: "Diploma or more" },
};

const ROWS = EN ? ROWS_EN : ROWS_IT;
const PHRASE = EN ? PHRASE_EN : PHRASE_IT;
const SHORT = EN ? SHORT_EN : SHORT_IT;

/** Largest-remainder rounding of counts into n figures (the pipeline's method, for rows without figures). */
export function largestRemainder(counts, keys, n) {
  const tot = keys.reduce((a, k) => a + (counts[k] || 0), 0);
  if (!(tot > 0)) return null;
  const raw = keys.map((k) => ((counts[k] || 0) / tot) * n);
  const out = raw.map(Math.floor);
  let left = n - out.reduce((a, v) => a + v, 0);
  const order = raw.map((v, j) => [v - Math.floor(v), j]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < left; k++) out[order[k][1]]++;
  return Object.fromEntries(keys.map((k, j) => [k, out[j]]));
}

/** "1 in 7", "3 in 10", "fewer than 1 in 1,000". */
export function oneIn(share) {
  if (share == null || !Number.isFinite(share)) return null;
  if (share <= 0) return { text: tr("nessuno", "none"), plural: true };
  if (share < 0.001) return { text: tr("meno di 1 su 1.000", "fewer than 1 in 1,000"), plural: false };
  if (share >= 0.3) {
    const k = Math.round(share * 10);
    return k >= 10 ? { text: tr("quasi tutti", "nearly all"), plural: true } : { text: tr(`${k} su 10`, `${k} in 10`), plural: k !== 1 };
  }
  const n = Math.round(1 / share);
  return { text: tr(`1 su ${int(n)}`, `1 in ${int(n)}`), plural: false };
}

function sentence(rowId, key, share, natShare, cityName, noun) {
  const a = oneIn(share);
  if (!a) return "";
  const ph = PHRASE[rowId]?.[key] || tr(["è in questo gruppo", "sono in questo gruppo"], ["is in this group", "are in this group"]);
  const us = oneIn(natShare);
  const lead = a.text.charAt(0).toUpperCase() + a.text.slice(1);
  return tr(`${lead} ${noun[1]} della provincia di ${cityName} ${a.plural ? ph[1] : ph[0]}${us ? ` (Italia: ${us.text})` : ""}`, `${lead} ${noun[1]} in the province of ${cityName} ${a.plural ? ph[1] : ph[0]}${us ? ` (Italy: ${us.text})` : ""}`);
}

function rowModel(rowDef, row, nat, groups, figuresN) {
  const keys = (groups[rowDef.id] || []).map((g) => g.key);
  const n = figuresN[rowDef.id] ?? rowDef.n ?? 10;
  const figs = row.figures || largestRemainder(row.counts || {}, keys, n);
  const natFigs = nat?.figures || (nat ? largestRemainder(nat.counts || {}, keys, n) : null);
  return { keys, n, figs, natFigs };
}

// Specialists by row/key from the file (ratios from unrounded shares).
function specMap(city) {
  const m = new Map();
  for (const s of city?.specialists || []) m.set(`${s.row}|${s.key}`, s);
  return m;
}

/** The Citizens rows. data = citizens.json (or null / undefined while loading). */
export function citizensHtml(m, data) {
  const c = m.city;
  if (data === undefined) return `<p class="muted cv-note">${tr("Carico gli abitanti…", "Loading the citizen mix…")}</p>`;
  if (!data || !data.cities) return `<p class="muted cv-note">${tr("I dati sugli abitanti non sono disponibili.", "The citizen mix is not available.")}</p>`;
  const row0 = data.cities[c.id];
  if (!row0) {
    return `<p class="muted cv-note">${tr(`Nessun dato sugli abitanti per ${esc(c.name)}.`, `No citizen figures for ${esc(c.name)}.`)}</p>`;
  }
  const nat = data.national || {};
  const groups = data.groups || {};
  const specs = specMap(row0);
  const label = Object.fromEntries(Object.entries(groups).map(([r, gs]) => [r, Object.fromEntries(gs.map((g) => [g.key, g.label]))]));

  // Headline: median age, degrees, foreign-born, and the "great person" call-out (the strongest specialist).
  const med = row0.age?.median, usMed = nat.age?.median;
  const ba = row0.education?.bachelors_plus, usBa = nat.education?.bachelors_plus;
  const fb = row0.nativity?.foreign_born ?? row0.nativity?.shares?.foreign_born;
  const usFb = nat.nativity?.foreign_born ?? nat.nativity?.shares?.foreign_born;
  const chip = (v, us, fmt, lbl, tip) => (v == null ? "" : `<div class="cv-cz-chip" title="${esc(tip)}"><b>${fmt(v)}</b><span>${esc(lbl)}</span>${us != null ? `<small>${tr("Italia", "Italy")} ${fmt(us)}</small>` : ""}</div>`);
  const top = (row0.specialists || []).find((s) => s.ratio >= (data.rule?.specialist_high ?? 1.5));
  const topRow = ROWS.find((r) => r.id === top?.row);
  const great = top && topRow ? `<div class="cv-great" style="--fc:${esc(CATEGORY_COLOR[top.row]?.[top.key] || "#c9a45c")}">
      <span class="cv-great-fig" data-great="${esc(top.row)}|${esc(top.key)}" aria-hidden="true"></span>
      <div><small>${tr("Abitanti che spiccano", "Standout citizens")}</small><b>${esc(label[top.row]?.[top.key] || top.key)}</b>
      <span>${tr(`${pct(top.share, 1)} dei ${esc(topRow.noun[1])} qui, ${pct(top.national, 1)} in Italia: ${top.ratio.toFixed(2).replace(".", DEC)}× la quota italiana.`, `${pct(top.share, 1)} of ${esc(topRow.noun[1])} here, ${pct(top.national, 1)} in Italy: ${top.ratio.toFixed(2)}× the Italian share.`)}</span></div></div>` : "";

  const rows = ROWS.map((rd) => {
    const row = row0[rd.id];
    const head = `<div class="cv-cz-h"><b>${esc(rd.title)}</b><span>${esc(rd.sub)}</span></div>`;
    if (!row) {
      return `<div class="cv-cz-row missing" data-row="${rd.id}">${head}
        <p class="muted cv-note">${tr("Nessun dato per questa riga.", "No data for this row.")}</p></div>`;
    }
    const { keys, n, figs, natFigs } = rowModel(rd, row, nat[rd.id], groups, data.figures || {});
    if (!figs) return `<div class="cv-cz-row missing" data-row="${rd.id}">${head}<p class="muted cv-note">${tr("Nessun conteggio per questa riga.", "No counts for this row.")}</p></div>`;
    const per = row.total / n;
    const cells = [];
    for (const k of keys) {
      for (let j = 0; j < (figs[k] || 0); j++) {
        const sp = specs.get(`${rd.id}|${k}`);
        const mark = sp ? (sp.ratio >= 1 ? "up" : "down") : "";
        // One tab stop per category (its first figure), not one per figure.
        cells.push(`<span class="cv-fig${mark ? ` ${mark}` : ""}" tabindex="${j ? -1 : 0}" role="img" data-k="${esc(k)}" aria-label="${esc(label[rd.id]?.[k] || k)}"></span>`);
      }
    }
    // Legend: every category, with its share, the U.S. share and a chevron for specialists. Categories that
    // round to no figure are still listed (greyed), so nothing silently disappears.
    const legend = keys.map((k) => {
      const sh = row.shares?.[k], us = nat[rd.id]?.shares?.[k];
      const sp = specs.get(`${rd.id}|${k}`);
      const chev = sp ? `<em class="${sp.ratio >= 1 ? "up" : "down"}" title="${sp.ratio.toFixed(2).replace(".", DEC)}× ${tr("la quota italiana", "the Italian share")}">${sp.ratio >= 1 ? "▲" : "▼"}</em>` : "";
      return `<span class="cv-cz-k${figs[k] ? "" : " zero"}" data-k="${esc(k)}" title="${esc(label[rd.id]?.[k] || k)}: ${sh != null ? pct(sh, 1) : "–"}${us != null ? ` (${tr("Italia", "Italy")} ${pct(us, 1)})` : ""}${figs[k] ? "" : tr(". Arrotondato a nessuna figurina.", ". Rounds to no figure.")}"><i style="background:${esc(CATEGORY_COLOR[rd.id]?.[k] || "#888")}"></i>${esc(SHORT[rd.id]?.[k] || k)} <small>${sh != null ? pct(sh, 0) : "–"}</small>${chev}</span>`;
    }).join("");
    // U.S. comparison bar (shares), aligned with the figures' order.
    const usBar = nat[rd.id]?.shares ? `<div class="cv-cz-us" title="${tr("La composizione italiana, stesso ordine", "Italy's mix, same order")}"><span>IT</span><div>${keys.map((k) => {
      const s = nat[rd.id].shares[k] || 0;
      return s > 0 ? `<i style="flex:${s};background:${esc(CATEGORY_COLOR[rd.id]?.[k] || "#888")}" title="${esc(SHORT[rd.id]?.[k] || k)}: ${pct(s, 1)} ${tr("in Italia", "in Italy")}"></i>` : "";
    }).join("")}</div></div>` : "";
    const cap = tr(`Ogni figurina ≈ ${compact(per)} ${rd.noun[1]} · ${compact(row.total)} in tutto`, `Each figure ≈ ${compact(per)} ${rd.noun[1]} · ${compact(row.total)} in all`);
    const extra = rd.id === "age" && med != null ? ` · ${tr("età mediana", "median age")} ${med.toFixed(1).replace(".", DEC)}${usMed != null ? ` (${tr("Italia", "Italy")} ${usMed.toFixed(1).replace(".", DEC)})` : ""}` : "";
    return `<div class="cv-cz-row" data-row="${rd.id}" style="--n:${n}">${head}
      <div class="cv-figs" role="group" aria-label="${esc(rd.title)}: ${keys.filter((k) => figs[k]).map((k) => `${figs[k]} su ${n} ${SHORT[rd.id]?.[k] || k}`).join(", ")}">${cells.join("")}</div>
      ${usBar}
      <div class="cv-cz-out" aria-live="polite" data-default="${esc(cap + extra)}">${esc(cap + extra)}</div>
      <div class="cv-cz-legend">${legend}</div>
    </div>`;
  }).join("");

  const unreliable = row0.reliable === false
    ? `<p class="cv-warn">Dati poco affidabili.</p>` : "";
  return `
    <div class="cv-cz-top">
      ${chip(med, usMed, (v) => v.toFixed(1).replace(".", DEC), tr("età mediana", "median age"), tr("Età mediana dei residenti (ISTAT 2023)", "Median age of residents (ISTAT 2023)"))}
      ${chip(ba, usBa, (v) => pct(v, 0), tr("con il diploma", "with a diploma"), tr("25-64enni con almeno il diploma (ISTAT BES 2019, in Qualità della vita 2020)", "People aged 25-64 with at least an upper-secondary diploma (ISTAT BES 2019, in Qualità della vita 2020)"))}
    </div>
    ${great}
    ${unreliable}
    <div class="cv-cz${row0.reliable === false ? " unreliable" : ""}">${rows}</div>
    <p class="cv-note">${esc(data.vintage || "")}. ${tr("Le figurine sono arrotondate (resti maggiori) perché ogni riga torni; passa sopra o tocca una figurina per la sua quota. ▲▼ = almeno 1,2 volte o al massimo 0,83 volte la quota italiana. Tutti i dati sono dell'intera provincia.", "Figures are rounded (largest remainder) so each row adds up; hover or tap a figure for its share. ▲▼ = at least 1.2× or at most 0.83× the Italian share. Every figure is for the whole province.")}</p>`;
}

/** Paint the figure canvases and wire the read-outs. */
export function mountCitizens(host, m, data) {
  if (!host || !data?.cities?.[m.city.id]) return;
  const row0 = data.cities[m.city.id];
  const nat = data.national || {};
  const dpr = Math.min(3, Math.max(1, Math.round((devicePixelRatio || 1) * 2) / 2));
  const paintAll = () => {
    host.querySelectorAll(".cv-cz-row[data-row]").forEach((rowEl) => {
      const rid = rowEl.dataset.row;
      rowEl.querySelectorAll(".cv-fig").forEach((el) => {
        const src = figureCanvas(rid, el.dataset.k, 36, dpr);
        const cv = document.createElement("canvas");
        cv.width = src.width;
        cv.height = src.height;
        cv.getContext("2d").drawImage(src, 0, 0);
        el.replaceChildren(cv);
      });
    });
    const g = host.querySelector("[data-great]");
    if (g) {
      const [rid, k] = g.dataset.great.split("|");
      const src = figureCanvas(rid, k, 36, dpr);
      const cv = document.createElement("canvas");
      cv.width = src.width;
      cv.height = src.height;
      cv.getContext("2d").drawImage(src, 0, 0);
      g.replaceChildren(cv);
    }
  };
  paintAll();
  // Once the citizen painter (render/art/people.js) loads, repaint the figures.
  loadPainter().then(() => { if (host.isConnected) paintAll(); });

  host.querySelectorAll(".cv-cz-row[data-row]").forEach((rowEl) => {
    const rid = rowEl.dataset.row;
    const rd = ROWS.find((r) => r.id === rid);
    const row = row0[rid];
    const out = rowEl.querySelector(".cv-cz-out");
    if (!row || !out) return;
    const show = (k) => {
      rowEl.querySelectorAll("[data-k]").forEach((el) => el.classList.toggle("lit", el.dataset.k === k));
      rowEl.classList.toggle("focus", !!k);
      if (!k) {
        out.textContent = out.dataset.default;
        out.classList.remove("on");
        return;
      }
      const sh = row.shares?.[k], us = nat[rid]?.shares?.[k];
      out.innerHTML = `${esc(sentence(rid, k, sh, us, m.city.name, rd.noun))}<small>${sh != null ? pct(sh, 1) : "–"} ${tr("qui", "here")}${us != null ? ` · ${pct(us, 1)} ${tr("in Italia", "in Italy")}` : ""}${row.counts?.[k] != null ? ` · ≈${compact(row.counts[k])} ${tr("persone", "people")}` : ""}</small>`;
      out.classList.add("on");
    };
    let pinned = null;
    rowEl.addEventListener("pointerover", (e) => {
      const el = e.target.closest("[data-k]");
      if (el && rowEl.contains(el)) show(el.dataset.k);
    });
    rowEl.addEventListener("pointerleave", () => show(pinned));
    rowEl.addEventListener("focusin", (e) => {
      const el = e.target.closest("[data-k]");
      if (el) show(el.dataset.k);
    });
    rowEl.addEventListener("focusout", () => show(pinned));
    // A tap pins the category (phones have no hover); another tap on it lets go.
    rowEl.addEventListener("click", (e) => {
      const el = e.target.closest("[data-k]");
      if (!el) return;
      pinned = pinned === el.dataset.k ? null : el.dataset.k;
      show(pinned);
    });
  });
}
