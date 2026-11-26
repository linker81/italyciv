// Hover tooltips for the map-art layers (HTML strings; every data value is escaped). Each says where the number comes
// from and the caveat that matters for it (FAF values are model estimates; bases have no published headcount; the
// trade arc is a drawing aid; curated landmarks are an editorial pick).
import { EN, t as tr } from "../../i18n.js";
import { esc, compact, int, pct } from "../../format.js";
import { FORT_KINDS, fortKind, WONDER_KINDS } from "../../render/art/sites.js";
import { MODE_STYLE } from "../../render/art/improvements.js";

const muted = (s) => `<span class="muted">${s}</span>`;
const num = (n, d = 1) => (n == null || !Number.isFinite(n) ? "–" : compact(n));
const sign = (x) => (x > 0 ? "+" : x < 0 ? "−" : "±");

function usd(n) {
  if (n == null || !Number.isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)} trillion`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(a >= 1e10 ? 1 : 2)} billion`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)} million`;
  return `$${int(n)}`;
}

const HUB_NAME = EN
  ? { L: "Large airport (≥ 10M passengers)", M: "Medium airport (≥ 3M)", S: "Small airport (≥ 500K)", N: "Minor airport" }
  : { L: "Grande aeroporto (≥ 10 mln di passeggeri)", M: "Aeroporto medio (≥ 3 mln)", S: "Aeroporto piccolo (≥ 500 mila)", N: "Aeroporto minore" };

export const tips = {
  port(p, m) {
    const lines = [
      `<b>${esc(p.name)}</b> ${muted(esc(p.state || ""))}`,
      tr(`Sede dell'Autorità di sistema portuale del ${esc(p.authority || "")}`, `Seat of the Port System Authority: ${esc(p.authority || "")}`),
      muted(tr("Nessun dato di traffico disponibile qui; posizione scelta a mano.", "No traffic data available here; position picked by hand.")),
    ];
    return lines.join("<br>");
  },
  airport(a) {
    const lines = [`<b>${esc(a.id)} · ${esc(a.name)}</b> ${muted(esc([a.city, a.state].filter(Boolean).join(", ")))}`];
    if (a.hub) lines.push(esc(HUB_NAME[a.hub] || a.hub));
    if (a.enplanements != null) lines.push(tr(`<b>${int(a.enplanements)}</b> passeggeri nel ${esc(a.year)}`, `<b>${int(a.enplanements)}</b> passengers in ${esc(a.year)}`));
    lines.push(muted(tr("Assaeroporti (via Wikipedia); posizione OurAirports.", "Assaeroporti (via Wikipedia); position from OurAirports.")));
    return lines.join("<br>");
  },
  fort() { return ""; },
  range() { return ""; },
  wonder(x, m) {
    const k = WONDER_KINDS[x.kind]?.name || tr("Meraviglia", "Wonder");
    const rule = m.data.wonders?.rules?.find((r) => r.id === x.rule);
    const mt = x.metrics || {};
    const lines = [`<b>${esc(x.name)}</b> ${muted(esc([x.state].filter(Boolean).join("")))}`];
    lines.push(tr(`${esc(k)} · Patrimonio mondiale UNESCO dal ${esc(mt.inscribed ?? "")}${mt.type ? ` (sito ${esc(mt.type)})` : ""}`, `${esc(k)} · UNESCO World Heritage since ${esc(mt.inscribed ?? "")}${mt.type ? ` (${esc(mt.type)} site)` : ""}`));
    if (rule?.text) lines.push(muted(esc(rule.text)));
    return lines.join("<br>");
  },
  route() { return ""; },
};
