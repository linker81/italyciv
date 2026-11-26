// A generic Italian advisor view: headline tiles, a map-colour picker (lenses), one ranking section per measure
// (provinces or regions, top and bottom) and a scatter of two measures over the 107 provinces. Each advisor is a
// config (views/*.js) passed to makeTopic(config).
//
// config: {tiles(data) → [{label, value, sub}], map: [lens ids], measures: [{key, title, note?, asc?}],
//          scatter: {x, y, size?, color?, title, note} | null, sources: [ids], caveats: [html], extra?(ctx, el)}
import { esc, fin, colorScale, robustDomain, RAMPS } from "../core/util.js";
import { pct, int, count3, fmtShort, fmtValue } from "../core/fmt.js";
import { barList, rampLegend } from "../core/charts.js";
import { createScatter } from "../core/scatter.js";
import { section, tiles, segmented, mapPicker, sourcesHtml, topBy } from "../core/view.js";
import { rowsHighlight } from "../core/data.js";
import { t as tr } from "../../../i18n.js";

export function makeTopic(cfg) {
  return {
    mount(ctx) {
      const { app, data, el, link } = ctx;
      const { states, metros } = data.levels;
      if (cfg.tiles) el.insertAdjacentHTML("beforeend", tiles(cfg.tiles(data)));

      // --- map colour ---
      const mapRow = document.createElement("div");
      mapRow.className = "adv-sec adv-mapsec";
      el.appendChild(mapRow);
      const lensOpts = (cfg.map || []).map((id) => app.lensById?.get(id)).filter(Boolean)
        .map((l) => ({ value: l.id, label: l.name, lens: () => l.id }));
      const picker = lensOpts.length ? mapPicker(ctx, mapRow, {
        label: tr("Mappa", "Map"), value: lensOpts[0].value, options: [...lensOpts, { value: "terrain", label: tr("Terreno", "Terrain"), lens: () => null }],
      }) : null;

      // --- rankings ---
      for (const ms of cfg.measures || []) {
        const f = metros.field(ms.key);
        if (!f) continue;
        const body = section(el, { title: ms.title || f.label, note: ms.note ?? esc(`${f.unit ? f.unit + ". " : ""}${f.description || ""}`) });
        let level = "metros";
        const host = document.createElement("div");
        const ctl = document.createElement("div");
        ctl.className = "adv-row";
        body.appendChild(ctl);
        segmented(ctl, { label: tr("Aree", "Areas"), value: level, options: [{ value: "metros", label: tr("Province", "Provinces") }, { value: "states", label: tr("Regioni", "Regions") }], onChange: (v) => { level = v; draw(); } });
        if (f.lens && app.lensById?.get(f.lens)) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "adv-mini";
          b.textContent = tr("Colora la mappa", "Colour the map");
          b.addEventListener("click", () => (picker && lensOpts.some((o) => o.value === f.lens) ? picker.set(f.lens) : ctx.setLens(app.lensById.get(f.lens))));
          ctl.appendChild(b);
        }
        body.appendChild(host);
        const draw = () => {
          host.innerHTML = "";
          const lv = level === "metros" ? metros : states;
          const val = (r) => r.v[ms.key];
          const n = level === "metros" ? 8 : 6;
          const hi = topBy(lv.rows, val, { n });
          const lo = topBy(lv.rows, val, { n, asc: true });
          const all = [...hi, ...lo].map((x) => Math.abs(x.v));
          const max = Math.max(1e-9, ...all);
          const tone = (v) => (f.higher_is === "good" ? "good" : f.higher_is === "bad" ? "bad" : null);
          const mk = (list, t) => list.map((x) => ({ key: x.r.key, label: x.r.name, sub: level === "metros" ? x.r.sub : "", value: x.v, text: fmtValue(f.format, x.v, f.unit), tone: t, row: x.r }));
          const opts = { max, onHover: (r) => link.hover(r ? rowsHighlight(lv, [r.row]) : null), onClick: (r) => lv.focus(r.row) };
          const good = f.higher_is === "bad" ? lo : hi, bad = f.higher_is === "bad" ? hi : lo;
          const tg = f.higher_is === "neutral" ? null : "good", tb = f.higher_is === "neutral" ? null : "bad";
          host.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">${esc(ms.hiTitle || (f.higher_is === "bad" ? tr("I valori più bassi", "Lowest values") : tr("I valori più alti", "Highest values")))}</h4>`);
          barList(host, { ...opts, rows: mk(good, tg), rank: true, ariaLabel: tr("Classifica", "Ranking") });
          host.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">${esc(ms.loTitle || (f.higher_is === "bad" ? tr("I valori più alti", "Highest values") : tr("I valori più bassi", "Lowest values")))}</h4>`);
          barList(host, { ...opts, rows: mk(bad, tb), rank: true, ariaLabel: tr("Classifica", "Ranking") });
          void tone;
        };
        draw();
      }

      // --- scatter ---
      let scatter = null;
      const sc = cfg.scatter;
      if (sc && metros.field(sc.x) && metros.field(sc.y)) {
        const fx = metros.field(sc.x), fy = metros.field(sc.y), fc = sc.color ? metros.field(sc.color) : null;
        const body = section(el, { title: sc.title, note: sc.note || tr("Ogni punto è una provincia; la dimensione è la popolazione. Trascina un rettangolo per selezionare: le province si accendono sulla mappa.", "Each dot is a province; size is population. Drag a rectangle to select: the provinces light up on the map.") });
        const cDom = fc ? robustDomain(metros.rows.map((r) => r.v[sc.color]), 0.02, fc.format === "int" || sc.colorLog) : null;
        const cScale = fc ? colorScale({ type: "seq", domain: cDom || [0, 1], log: !!sc.colorLog, ramp: RAMPS.heat }) : null;
        const big = topBy(metros.rows, (r) => r.v.population, { n: 6 }).map((x) => x.r.key);
        const info = document.createElement("div");
        info.className = "adv-brushinfo";
        scatter = createScatter(body, {
          height: 300,
          points: metros.rows.map((r) => ({ key: r.key, x: r.v[sc.x], y: r.v[sc.y], s: r.v.population, c: fc ? r.v[sc.color] : null, label: r.name, sub: r.sub, row: r })),
          x: { label: fx.label, fmt: (v) => fmtShort(fx.format, v), log: !!sc.xLog },
          y: { label: fy.label, fmt: (v) => fmtShort(fy.format, v), log: !!sc.yLog },
          size: { label: tr("Popolazione", "Population"), fmt: count3, max: 14, min: 2 },
          color: cScale ? (c) => (fin(c) ? cScale(c) : "#777") : undefined,
          colorLabel: fc?.label, colorFmt: fc ? (v) => fmtValue(fc.format, v, fc.unit) : undefined,
          labels: big,
          onHover: (p) => link.hover(p ? rowsHighlight(metros, [p.row]) : null),
          onClick: (p) => metros.focus(p.row),
          onBrush: (set) => {
            const sel = set ? metros.rows.filter((r) => set.has(r.key)) : [];
            link.base(sel.length ? rowsHighlight(metros, sel, { dim: true }) : null, { frame: sel.length > 1 });
            const pop = sel.reduce((a, r) => a + (r.v.population || 0), 0);
            info.innerHTML = sel.length ? `<b>${int(sel.length)}</b> ${tr("province", "provinces")} · ${count3(pop)} ${tr("abitanti", "people")} (${pct(pop / (data.nat.population || 1))} ${tr("dell'Italia", "of Italy")})<br><span class="sub">${sel.slice(0, 8).map((r) => esc(r.name)).join(" · ")}${sel.length > 8 ? " …" : ""}</span>` : "";
          },
        });
        if (fc && cDom) body.insertAdjacentHTML("beforeend", rampLegend({ ramp: RAMPS.heat, domain: cDom, log: !!sc.colorLog, fmt: (v) => fmtShort(fc.format, v), label: fc.label }));
        body.appendChild(info);
      }

      if (cfg.extra) cfg.extra(ctx, el);
      el.insertAdjacentHTML("beforeend", sourcesHtml(data, cfg.sources || ["istat_popolazione", "qdv2020"], [
        tr("Ogni «città» è l'intera provincia del suo capoluogo: tutti i numeri sono provinciali.", "Each “city” is its capital's whole province: every number is provincial."),
        tr("Per le regioni le misure provinciali sono medie pesate per popolazione: un'approssimazione, non il dato regionale ufficiale.", "For regions, provincial measures are population-weighted means: an approximation, not the official regional figure."),
        tr("Gli indicatori di Qualità della vita 2020 si riferiscono quasi tutti al 2019-2020; la popolazione al 2023.", "The Qualità della vita 2020 indicators are almost all from 2019-2020; population is from 2023."),
        ...(cfg.caveats || []),
      ]));

      return {
        onMapHover(h) {
          const r = h.cell >= 0 ? metros.rowAtCell(h.cell) : null;
          scatter?.setHot(r ? r.key : null);
        },
        onEscape() {
          if (scatter?.selected) { scatter.setSelected(null); link.base(null); return true; }
          return false;
        },
      };
    },
  };
}
