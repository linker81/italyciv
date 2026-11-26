// Energy & Resources advisor: the mapped power sites, mines and oil & gas plays.
import { esc, fin } from "../core/util.js";
import { fmtValue, mw, int, count3 } from "../core/fmt.js";
import { barList, shareBar, stackedBars, sizeLegend } from "../core/charts.js";
import { createTable } from "../core/table.js";
import { section, tiles, chips, sourcesHtml } from "../core/view.js";
import { frameBox, focusPoint } from "../core/frame.js";
import { glyph } from "../../../ui/icon.js";
import { t as tr } from "../../../i18n.js";

const GROUPS = [
  { id: "thermal", label: tr("Centrali termiche", "Thermal power plants"), types: ["gas_plant", "coal_plant", "oil", "geothermal"] },
  { id: "water", label: tr("Idroelettrico", "Hydro"), types: ["hydro"] },
  { id: "renew", label: tr("Sole e vento", "Sun & wind"), types: ["solar", "wind"] },
];

export function mount(ctx) {
  const { app, data, el, link } = ctx;
  const res = app.data.resources;
  if (!res) {
    el.innerHTML = tr(`<p class="adv-empty pad">Manca resources.json: non c'è niente da mostrare.</p>`, `<p class="adv-empty pad">resources.json is not built, so there is nothing to show here.</p>`);
    return {};
  }
  const types = res.types;
  const typeById = new Map(types.map((t) => [t.id, t]));
  const items = res.items.map((it, i) => ({ ...it, idx: i, key: String(i) }));
  const nat = res.summary?.national || {};
  const isMW = (t) => typeById.get(t)?.unit === "MW";
  const mwTypes = types.filter((t) => t.unit === "MW");
  const states = app.data.states || [];
  const stateIdx = new Map(states.map((s, i) => [s.abbr, i]));
  // Draw groups in GROUPS order, plus any type the groups do not list.
  const listed = new Set(GROUPS.flatMap((g) => g.types));
  const groups = GROUPS.map((g) => ({ ...g, types: g.types.filter((t) => typeById.has(t)) })).filter((g) => g.types.length);
  const extra = types.filter((t) => !listed.has(t.id)).map((t) => t.id);
  if (extra.length) groups.push({ id: "other", label: tr("Altro", "Other"), types: extra });

  const st = { on: new Set(types.map((t) => t.id)), min: 0, state: null };
  ctx.setShowResources(true);

  // --- headline -------------------------------------------------------------------------------------------------
  const totalMW = mwTypes.reduce((a, t) => a + (nat[t.id]?.value || 0), 0);
  const sites = mwTypes.reduce((a, t) => a + (nat[t.id]?.count || 0), 0);
  const top = el.appendChild(document.createElement("div"));
  top.innerHTML = tiles([
    { label: tr("Potenza sulla mappa", "Mapped power"), value: mw(totalMW), sub: tr(`${int(sites)} impianti`, `${int(sites)} sites`) },
    { label: tr("Idroelettrico", "Hydro"), value: mw(nat.hydro?.value || 0), sub: tr(`${int(nat.hydro?.count || 0)} centrali ≥ 100 MW`, `${int(nat.hydro?.count || 0)} plants ≥ 100 MW`) },
    { label: "Gas", value: mw(nat.gas_plant?.value || 0), sub: tr(`${int(nat.gas_plant?.count || 0)} centrali ≥ 400 MW`, `${int(nat.gas_plant?.count || 0)} plants ≥ 400 MW`) },
  ]) + `<p class="adv-callout">${esc(res.summary?.note || tr("Totali dei soli impianti sulla mappa.", "Totals of the mapped sites only."))}</p>`;

  // --- national mix ---------------------------------------------------------------------------------------------
  const mixBody = section(el, { title: tr("Il mix elettrico nazionale", "The national power mix"), kicker: tr("Impianti sopra soglia", "Mapped sites above thresholds"), note: tr("Potenza degli impianti sulla mappa, per tipo. Gli impianti piccoli non sono mappati, quindi questa <b>non</b> è la potenza installata italiana: mostra dove sono i grandi impianti e con che cosa funzionano. Dati WRI aggiornati al 2021.", "Capacity of the power sites on the map, by type. Small plants are not mapped, so this is <b>not</b> Italy's installed capacity: it shows where the large sites are and what they run on. WRI data, last updated 2021.") });
  const mixParts = mwTypes.map((t) => ({ key: t.id, label: t.name, value: nat[t.id]?.value || 0, color: t.color, text: mw(nat[t.id]?.value), icon: glyph(t, 14) })).sort((a, b) => b.value - a.value);
  const mixHover = (p) => {
    if (!p) { link.hover(null); bubbles.setSelected(null); return; }
    const set = new Set(visible().filter((it) => it.type === p.key).map((it) => it.idx));
    link.hover({ resources: set, dimOthers: true });
    bubbles.setSelected(new Set(visible().filter((it) => it.type === p.key).map((it) => it.key)));
  };
  const solo = (typeId) => {
    const only = st.on.size === 1 && st.on.has(typeId);
    st.on = only ? new Set(types.map((t) => t.id)) : new Set([typeId]);
    typeChips.set(st.on);
    apply();
  };
  shareBar(mixBody, { parts: mixParts, legend: false, onHover: mixHover, onClick: (p) => solo(p.key) });
  const mixBars = barList(mixBody, {
    rows: mixParts.map((p) => ({ ...p, sub: tr(`${int(nat[p.key]?.count || 0)} impianti`, `${int(nat[p.key]?.count || 0)} sites`) })),
    onHover: mixHover, onClick: (p) => solo(p.key), ariaLabel: tr("Potenza mappata per tipo", "Mapped capacity by type"),
  });

  // --- filters --------------------------------------------------------------------------------------------------
  const fBody = section(el, { title: tr("Filtra la mappa", "Filter the map"), note: tr("Accendi o spegni i tipi (Alt-clic per mostrarne uno solo). La mappa attenua il terreno e disegna ogni impianto come un cerchio grande quanto la sua potenza.", "Toggle types (Alt-click to show only one). The map dims the terrain and draws each power site as a circle sized by its capacity.") });
  const typeChips = chips(fBody, {
    label: tr("Tipi di risorsa", "Resource types"),
    items: groups.flatMap((g) => g.types.map((t) => {
      const ty = typeById.get(t);
      return { key: t, label: ty.name.replace(/ \(shale play\)/, ""), color: ty.color, icon: glyph(ty, 13), count: nat[t]?.count ?? null };
    })),
    onChange: (on) => { st.on = on; apply(); },
  });
  const quick = document.createElement("div");
  quick.className = "adv-row";
  quick.innerHTML = groups.map((g) => `<button type="button" class="adv-mini" data-g="${g.id}">${esc(g.label)}</button>`).join("") +
    tr(`<button type="button" class="adv-mini" data-g="all">Tutti</button><button type="button" class="adv-mini" data-g="none">Nessuno</button>`, `<button type="button" class="adv-mini" data-g="all">All</button><button type="button" class="adv-mini" data-g="none">None</button>`);
  fBody.appendChild(quick);
  quick.addEventListener("click", (e) => {
    const g = e.target.closest("[data-g]")?.dataset.g;
    if (!g) return;
    st.on = g === "all" ? new Set(types.map((t) => t.id)) : g === "none" ? new Set() : new Set(groups.find((x) => x.id === g).types);
    typeChips.set(st.on);
    apply();
  });
  const slider = document.createElement("div");
  slider.className = "adv-slider";
  slider.innerHTML = `<label><span>${tr("Potenza minima", "Minimum size")}</span><input type="range" min="0" max="3000" step="100" value="0" aria-label="${tr("Potenza minima degli impianti in MW", "Minimum power-site capacity in MW")}"><b>${tr("Qualsiasi", "Any size")}</b></label>
    <p class="adv-note adv-min-note" hidden>Mines and oil &amp; gas plays are hidden while a minimum is set: they are not measured in MW.</p>`;
  fBody.appendChild(slider);
  const range = slider.querySelector("input");
  range.addEventListener("input", () => {
    st.min = +range.value;
    slider.querySelector("b").textContent = st.min ? `≥ ${int(st.min)} MW` : tr("Qualsiasi", "Any size");
    slider.querySelector(".adv-min-note").hidden = !st.min;
    apply();
  });
  const stateChip = document.createElement("div");
  stateChip.className = "adv-row adv-filterbar";
  fBody.appendChild(stateChip);
  stateChip.addEventListener("click", (e) => { if (e.target.closest("[data-clear-state]")) setState(null); });
  const legendBox = document.createElement("div");
  fBody.appendChild(legendBox);

  // --- top sites ------------------------------------------------------------------------------------------------
  const tBody = section(el, { title: tr("Impianti", "Sites"), note: tr("Ogni impianto sulla mappa che passa i filtri. Passaci sopra per trovarlo sulla mappa; clicca per andarci.", "Every mapped site that passes the filters. Hover to find it on the map; click to fly there.") });
  const sizeSort = (r) => (isMW(r.type) && fin(r.value) ? r.value : null);
  const table = createTable(tBody, {
    caption: tr("Impianti sulla mappa", "Mapped sites"),
    search: tr("Cerca impianti, regioni, gestori", "Search sites, regions, operators"),
    searchText: (r) => `${r.name} ${r.state || ""} ${r.detail || ""} ${typeById.get(r.type)?.name || ""}`,
    rank: true,
    columns: [
      { key: "name", label: tr("Impianto", "Site"), align: "l", width: "minmax(0,1.7fr)", value: (r) => r.name, html: (r) => `<span class="ic">${glyph(typeById.get(r.type), 13)}</span>${esc(r.name)}` },
      { key: "type", label: tr("Tipo", "Type"), align: "l", width: "minmax(0,1fr)", value: (r) => typeById.get(r.type)?.name, text: (r) => typeById.get(r.type)?.name.replace(/ \(shale play\)/, "") || r.type },
      { key: "state", label: tr("Regione", "Region"), align: "l", width: "46px", value: (r) => r.state, text: (r) => r.state || "–" },
      { key: "value", label: tr("Potenza", "Capacity"), width: "minmax(0,.95fr)", value: sizeSort, text: (r) => sizeText(r), title: tr("Ordina per potenza (MW)", "Sort by capacity (MW)") },
    ],
    rows: [],
    sort: { key: "value", dir: "desc" },
    maxHeight: 300,
    onHover: (r) => {
      link.hover(r ? { resources: new Set([r.idx]), dimOthers: true, label: r.name } : null);
      bubbles.setHot(r ? r.key : null);
    },
    onClick: (r) => flyTo(r),
  });
  function sizeText(r) {
    const t = typeById.get(r.type);
    if (!fin(r.value)) return "–";
    if (t?.unit === "MW") return mw(r.value);
    if (t?.unit === "employees") return `${int(r.value)} staff`;
    if (/tons/.test(t?.unit || "")) return `${count3(r.value)} t/yr`;
    if (/km/.test(t?.unit || "")) return `${count3(r.value)} km²`;
    return fmtValue("float", r.value);
  }
  function flyTo(r) {
    focusPoint(app, r.x, r.y, Math.min(app.cam.maxScale, Math.max(app.cam.scale, (app.cam.fitScale || 1) * 3.2)));
  }

  // --- per state ------------------------------------------------------------------------------------------------
  const sBody = section(el, { title: tr("Potenza per regione", "Power by region"), note: tr("Potenza mappata per regione, per tipo. Clicca una regione per filtrare tutto su di essa; clicca di nuovo per togliere il filtro.", "Mapped capacity per region, by type. Click a region to filter everything to it; click it again to clear.") });
  const stateRows = states
    .map((s, i) => ({ key: s.abbr, label: s.name, idx: i, parts: s.energy?.by_type || {}, total: s.energy?.total || 0, text: mw(s.energy?.total) }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const stacks = stackedBars(sBody, {
    rows: stateRows, keys: mwTypes.map((t) => ({ key: t.id, label: t.name, color: t.color })), fmt: (v) => mw(v),
    ariaLabel: tr("Potenza mappata per regione", "Mapped power capacity by region"),
    onHover: (x) => {
      if (!x) return link.hover(null);
      const sIdx = x.row.idx;
      const set = x.part ? new Set(items.filter((it) => it.state === x.row.key && it.type === x.part).map((it) => it.idx)) : undefined;
      link.hover({ states: new Set([sIdx]), resources: set, dimOthers: true, label: x.part ? `${x.row.label}: ${typeById.get(x.part)?.name || x.part}` : x.row.label });
    },
    onClick: (x) => setState(st.state === x.row.key ? null : x.row.key, true),
  });
  const noPower = states.filter((s) => !(s.energy?.total > 0)).map((s) => s.abbr);
  if (noPower.length) sBody.insertAdjacentHTML("beforeend", tr(`<p class="adv-note">Nessun impianto mappato: ${esc(noPower.join(", "))}.</p>`, `<p class="adv-note">No mapped power site: ${esc(noPower.join(", "))}.</p>`));

  // --- explainer ------------------------------------------------------------------------------------------------
  const eBody = section(el, { title: tr("Che cosa significano i simboli", "What the symbols mean"), note: tr("Ogni tipo di risorsa, la soglia per essere mappato e la fonte dei dati.", "Each resource type, the threshold a site must pass to be mapped, and where the data comes from.") });
  eBody.innerHTML = groups.map((g) => `<h4 class="adv-h4">${esc(g.label)}</h4>${g.types.map((t) => {
    const ty = typeById.get(t);
    const s = nat[t] || {};
    const src = data.source(ty.source);
    const total = fin(s.value) ? (ty.unit === "MW" ? mw(s.value) : `${count3(s.value)} ${ty.unit}`) : ty.unit === "km² play area" ? tr("aree non sommabili", "areas not additive") : "";
    return `<div class="adv-explain" style="--cc:${esc(ty.color)}"><span class="ic">${glyph(ty, 22)}</span><div>
      <b>${esc(ty.name)}</b> <span class="sub">${int(s.count || 0)} mapped${total ? ` · ${esc(total)}` : ""} · measured in ${esc(ty.unit)}</span>
      <p>${esc(ty.description)}</p><span class="src">Source: ${esc(src ? `${src.title} (${src.vintage || src.publisher})` : ty.source)}</span></div></div>`;
  }).join("")}`).join("");

  el.insertAdjacentHTML("beforeend", sourcesHtml(data, ["wri_gppd"], [
    tr("Sono mappati solo gli impianti sopra la soglia del loro tipo (per esempio le centrali a gas da 400 MW in su), quindi i totali <b>non</b> sono la potenza regionale o nazionale.", "Only sites above each type's threshold are mapped (for example gas plants of 400 MW or more), so totals are <b>not</b> regional or national capacity."),
    tr("La potenza (MW) non è l'energia prodotta: un parco solare da 100 MW produce in un anno molto meno di una centrale a gas da 100 MW.", "Capacity (MW) is not the electricity produced: a 100 MW solar farm generates far less in a year than a 100 MW gas plant."),
    tr("Il database WRI è aggiornato al 2021: diverse centrali a carbone e a olio sono state chiuse o convertite dopo. Il fotovoltaico italiano è soprattutto su piccoli impianti, qui assenti.", "The WRI database was last updated in 2021: several coal and oil plants have closed or been converted since. Italian solar is mostly small installations, not shown here."),
  ]));

  // --- map ------------------------------------------------------------------------------------------------------
  const bubbles = ctx.bubbles("sites", {
    rMax: 24,
    tip: (b) => {
      const it = b.it, t = typeById.get(it.type);
      return `<b>${esc(it.name)}</b><br>${esc(t.name)} · <b>${esc(mw(it.value))}</b>${it.state ? ` · ${esc(it.state)}` : ""}${it.detail ? `<br><span class="sub">${esc(it.detail)}</span>` : ""}`;
    },
    onHover: (b) => table.setHot(b ? b.key : null),
    onClick: (b) => { table.setHot(b.key); flyTo(b.it); },
  });

  function visible() {
    return items.filter((it) => st.on.has(it.type) && (!st.min || (isMW(it.type) && fin(it.value) && it.value >= st.min)) && (!st.state || it.state === st.state));
  }

  function setState(abbr, fly = false) {
    st.state = abbr;
    stacks.setSelected(abbr);
    apply();
    if (abbr && fly) {
      const b = app.highlightBounds({ states: new Set([stateIdx.get(abbr)]) });
      if (b) frameBox(app, b, { pad: 30, maxScale: 2.6 });
    }
  }

  function apply() {
    const typesOn = st.min ? new Set([...st.on].filter(isMW)) : st.on;
    const all = typesOn.size === types.length && !st.min;
    ctx.setResourceFilter(all ? null : { types: new Set(typesOn), minValue: st.min || undefined });
    const vis = visible();
    table.setRows(vis);
    const mwVis = vis.filter((it) => isMW(it.type) && fin(it.value));
    const vMax = Math.max(1, ...items.filter((it) => isMW(it.type) && fin(it.value)).map((it) => it.value));
    bubbles.set(mwVis.map((it) => ({ key: it.key, x: it.x, y: it.y, value: it.value, color: typeById.get(it.type).color, it })), { vMax });
    const sIdx = st.state ? stateIdx.get(st.state) : null;
    link.base({ dimOthers: true, states: sIdx != null ? new Set([sIdx]) : undefined });
    stateChip.innerHTML = st.state
      ? tr(`<span class="adv-fchip">Regione: <b>${esc(states[sIdx]?.name || st.state)}</b> · ${int(vis.length)} impianti<button type="button" data-clear-state aria-label="Togli il filtro per regione">✕</button></span>`, `<span class="adv-fchip">Region: <b>${esc(states[sIdx]?.name || st.state)}</b> · ${int(vis.length)} sites<button type="button" data-clear-state aria-label="Clear the region filter">✕</button></span>`)
      : "";
    const r = (v) => 24 * Math.sqrt(v / vMax);
    legendBox.innerHTML = sizeLegend([250, 1000, 4000].filter((v) => v <= vMax * 1.2), r, (v) => `${int(v)} MW`, tr("Area del cerchio = potenza", "Circle area = capacity"));
    mixBars.setSelected(st.on.size === 1 ? [...st.on][0] : null);
  }
  apply();

  return {
    onMapHover(h) {
      if (h.resource) {
        const it = items[res.items.indexOf(h.resource)];
        if (it) table.setHot(it.key);
      }
    },
    onEscape() {
      if (st.state) { setState(null); return true; }
      return false;
    },
    destroy() {},
  };
}
