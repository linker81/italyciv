import { css } from "../color.js";
import { esc } from "../format.js";
import { t } from "../i18n.js";
import { isCapital } from "../world.js";
import { yieldGrid, amenities, industries, gdpRow, popLine, growthSpan, showPanel, hidePanel } from "./infoPanel.js";

/**
 * ctx: {w, nation, onClose, onPedia, onState(stateIndex)}
 */
export function openCityPanel(city, ctx) {
  const { w, nation } = ctx;
  const n = nation.nation;
  const owner = city.cell != null ? w.raw.owner[city.cell] : -1;
  const col = css(w.stateColor[owner] || [190, 190, 190]);

  // The city's states as links to their state panels.
  const states = (city.states || [])
    .map((abbr) => ({ abbr, i: w.raw.states.findIndex((s) => s.abbr === abbr) }))
    .map(({ abbr, i }) => (i >= 0 && ctx.onState
      ? `<button class="chip" data-state="${i}" title="${t("Apri", "Open")} ${esc(w.raw.states[i].name)}">${esc(abbr)}</button>`
      : `<span class="chip">${esc(abbr)}</span>`))
    .join("");

  const growth = growthSpan(city, n);

  showPanel({
    kind: "city",
    stripe: col,
    title: city.name,
    titleHtml: `${isCapital(city) ? `<span class="cap" title="${t("Capitale", "Capital")}">★</span> ` : ""}${esc(city.name)}`,
    sub: `${esc(city.full || "")}${states ? `<div class="chips">${states}</div>` : ""}`,
    headExtra: popLine(city, growth),
    sections: [
      { title: t("Rese", "Yields"), html: `<div class="yield-grid">${yieldGrid(nation, city.yields)}</div>` },
      { title: t("Benessere e casa", "Prosperity & housing"), html: amenities(city, n) + gdpRow(city) },
      city.jobs && { title: t("Distretti · dove si lavora", "Districts · where people work"), html: industries(city, nation) },
    ],
    foot: t(`Fonti: ${esc(nation.vintage)}. La «città» è l'intera provincia (o città metropolitana) del capoluogo: tutti i dati sono provinciali.`, `Sources: ${esc(nation.vintage)}. A “city” is the whole province (or metropolitan city) of its capital: every figure is provincial.`),
    onClose: ctx.onClose,
    onPedia: ctx.onPedia,
    wire(panel) {
      panel.querySelectorAll("[data-state]").forEach((b) => (b.onclick = () => ctx.onState(+b.dataset.state)));
    },
  });
}

export const closeCityPanel = hidePanel;
