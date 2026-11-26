// Cultura e vita quotidiana: meraviglie UNESCO, spettacoli, ristoranti, sicurezza, ambiente.
import { makeTopic } from "./topic.js";
import { int, count3 } from "../core/fmt.js";
import { esc } from "../core/util.js";
import { section } from "../core/view.js";
import { barList } from "../core/charts.js";
import { t } from "../../../i18n.js";

export const { mount } = makeTopic({
  tiles: (d) => [
    { label: t("Spettacoli in un anno", "Shows in a year"), value: count3(d.nat.yields?.culture), sub: "SIAE 2019" },
    { label: t("Ristoranti", "Restaurants"), value: count3(d.nat.yields?.food), sub: "Infocamere 2020" },
    { label: t("Siti UNESCO", "UNESCO sites"), value: int(d.app.data.wonders?.national?.unesco_sites ?? d.app.data.wonders?.wonders?.length), sub: t("Patrimonio mondiale", "World Heritage") },
  ],
  map: ["culture", "restaurants", "crime", "turnout", "climate_risk"],
  measures: [
    { key: "culture", title: t("Offerta culturale", "Cultural offer"), hiTitle: t("Più spettacoli", "Most shows"), loTitle: t("Meno spettacoli", "Fewest shows") },
    { key: "restaurants", title: t("Ristoranti", "Restaurants") },
    { key: "crime", title: t("Delitti denunciati", "Reported crimes"), hiTitle: t("Meno delitti denunciati", "Fewest reported crimes"), loTitle: t("Più delitti denunciati", "Most reported crimes") },
    { key: "turnout", title: t("Affluenza alle europee 2019", "Turnout at the 2019 European elections") },
    { key: "climate_risk", title: t("Rischio climatico (2021-2050)", "Climate risk (2021-2050)"), hiTitle: t("Rischio più basso", "Lowest risk"), loTitle: t("Rischio più alto", "Highest risk") },
  ],
  scatter: { x: "culture", y: "crime", color: "income", xLog: true, title: t("Spettacoli e delitti", "Shows and crime"), note: t("Ogni punto è una provincia: spettacoli ogni 1.000 abitanti (scala logaritmica) in orizzontale, delitti denunciati ogni 100.000 abitanti in verticale; colore = reddito.", "Each dot is a province: shows per 1,000 residents (log scale) across, reported crimes per 100,000 residents up; colour = income.") },
  caveats: [t("I delitti denunciati dipendono anche dalla propensione a denunciare e dai turisti presenti: non sono una misura diretta della sicurezza.", "Reported crimes also depend on how willing people are to report and on tourists present: they are not a direct measure of safety.")],
  sources: ["qdv2020", "istat_popolazione", "unesco_whc"],
  extra(ctx, el) {
    const w = ctx.app.data.wonders?.wonders || [];
    if (!w.length) return;
    const by = new Map();
    for (const x of w) by.set(x.state, (by.get(x.state) || 0) + 1);
    const states = ctx.data.levels.states;
    const body = section(el, { title: t("Meraviglie: siti UNESCO per regione", "Wonders: UNESCO sites by region"), note: t("I siti del Patrimonio mondiale disegnati sulla mappa (quelli con una località principale), per regione. Passa sopra per vederli.", "The World Heritage sites drawn on the map (those with one main location), by region. Hover to see them.") });
    const rows = [...by].sort((a, b) => b[1] - a[1]).map(([abbr, k]) => {
      const r = states.byKey.get(abbr);
      return { key: abbr, label: r?.name || abbr, value: k, text: String(k), row: r };
    });
    barList(body, {
      rows, rank: true,
      onHover: (r) => {
        if (!r) return ctx.link.hover(null);
        const cells = new Set(w.filter((x) => x.state === r.key).map((x) => x.cell));
        ctx.link.hover({ cells, dimOthers: false, label: `${esc(r.label)}: ${r.value} ${t("siti", "sites")}` });
      },
      onClick: (r) => r.row && states.focus(r.row),
    });
  },
});
