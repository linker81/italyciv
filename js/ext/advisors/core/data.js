// The advisors' data model for Italy: two "levels" — regions (states.json) and provinces (cities.json, one city per
// province, with every counties.json column merged in) — of rows with typed fields, plus the links between rows and
// the hex map (row → highlight, cell → row). counties.json loads on demand (app.loadCounties) before this runs.
//
//   level = {id, label, noun, rows: [row], fields: [field], field(key), value(row, key),
//            highlight(rows, opts) → app.state.highlight, rowAtCell(cell) → row | null, focus(row), byKey: Map}
//   row   = {key, name, sub, level, ref, v: {fieldKey: value}}
//   field = {key, label, format, unit, higher_is, source, description, lens?, group, derived?}
import { fin, ratio } from "./util.js";
import { t as tr, EN } from "../../../i18n.js";

// counties.json columns that have a lens of the same meaning in lenses.json.
const LENS_OF = {
  density: "density", median_age: "age", elderly: "elderly", income: "income", home_value: "home_value", rent: "rent",
  deposits: "deposits", rdc: "rdc", employment: "employment", export: "export", bachelors: "bachelors", neet: "neet",
  broadband: "broadband", startups: "startups", culture: "culture", restaurants: "restaurants", crime: "crime",
  cars: "cars", turnout: "turnout", antidepressants: "antidepressants", climate_risk: "climate_risk",
};
const GN = EN ? { Persone: "People", Benessere: "Prosperity", Lavoro: "Work", Conoscenza: "Knowledge", "Vita quotidiana": "Daily life", "Salute e sicurezza": "Health & safety", Ambiente: "Environment", Territorio: "Land", Altro: "Other", Rese: "Yields", Nome: "Name" } : {};
const G = (g) => GN[g] || g;
const GROUP_OF = {
  population: "Persone", density: "Persone", median_age: "Persone", elderly: "Persone", growth: "Persone", old_age: "Persone", births: "Persone",
  income: "Benessere", home_value: "Benessere", rent: "Benessere", deposits: "Benessere", rdc: "Benessere", pension: "Benessere",
  employment: "Lavoro", gender_gap: "Lavoro", export: "Lavoro",
  bachelors: "Conoscenza", neet: "Conoscenza", lifelong: "Conoscenza", broadband: "Conoscenza", startups: "Conoscenza", libraries: "Conoscenza", bookshops: "Conoscenza",
  culture: "Vita quotidiana", box_office: "Vita quotidiana", restaurants: "Vita quotidiana", bars: "Vita quotidiana", cars: "Vita quotidiana",
  road_casualties: "Vita quotidiana", turnout: "Vita quotidiana",
  gps: "Salute e sicurezza", nurses: "Salute e sicurezza", antidepressants: "Salute e sicurezza", crime: "Salute e sicurezza", court_days: "Salute e sicurezza",
  eco_urban: "Ambiente", climate_risk: "Ambiente", land_km2: "Territorio",
};
export const LAND_KEYS = [];
export const LAND_LABEL = {};
export const LAND_COLOR = {};

export function buildData(app) {
  const { cities = [], states = [], nation = {}, counties, resources, sources = [] } = app.data;
  const w = app.w;
  const grid = w.grid;
  const owner = w.raw.owner;
  const countyOf = w.raw.county || [];
  const n = grid.size;

  const stateCells = new Map();
  const countyCells = new Map();
  for (let i = 0; i < n; i++) {
    const o = owner[i];
    if (!(o >= 0)) continue;
    if (!stateCells.has(o)) stateCells.set(o, []);
    stateCells.get(o).push(i);
    const c = countyOf[i];
    if (c >= 0) {
      if (!countyCells.has(c)) countyCells.set(c, []);
      countyCells.get(c).push(i);
    }
  }
  const provIndex = new Map((w.raw.counties || []).map((c, k) => [c.geoid, k]));
  const cellMetro = new Map();
  const cityOfProv = new Map(cities.map((c) => [c.province ?? c.counties?.[0], c]));
  for (let i = 0; i < n; i++) {
    const k = countyOf[i];
    if (k >= 0 && owner[i] >= 0) {
      const c = cityOfProv.get(w.raw.counties[k].geoid);
      if (c) cellMetro.set(i, c);
    }
  }

  const srcTitle = new Map(sources.map((s) => [s.id, s]));
  const nat = nation.nation || {};
  const vintage = nation.vintage || "";
  const countyVintage = counties?.vintage || vintage;
  const F = (key, label, format, o = {}) => ({ key, label, format, unit: o.unit || null, higher_is: o.higher_is || "neutral", source: o.source || "", description: o.description || "", lens: o.lens || null, group: G(o.group || GROUP_OF[key] || "Altro"), derived: !!o.derived });

  // --- counties.json columns (one row per province) -----------------------------------------------------------
  const cFields = counties ? counties.fields.filter((f) => !["geoid", "name", "state", "sigla", "cbsa", "cell", "population"].includes(f.key)) : [];
  const cCol = counties ? Object.fromEntries(counties.columns.map((k, j) => [k, j])) : {};
  const cRowByGeo = new Map(counties ? counties.rows.map((r) => [r[cCol.geoid], r]) : []);
  const provVals = (geo) => {
    const r = cRowByGeo.get(geo);
    const out = {};
    for (const f of cFields) out[f.key] = r ? r[cCol[f.key]] ?? null : null;
    return out;
  };

  const yieldFields = (nation.yields || []).map((y) => F(`y_${y.key}`, y.label, y.unit === "usd" ? "money" : "int", { unit: y.unit === "usd" ? tr("€ all'anno", "€ per year") : y.unit, group: "Rese", description: y.description, source: "qdv2020" }));
  const baseFields = [
    F("population", tr("Popolazione", "Population"), "int", { unit: tr("abitanti", "people"), source: "istat_popolazione", group: "Persone", description: tr("Residenti al 1° gennaio 2023 (ISTAT).", "Residents on 1 January 2023 (ISTAT)."), lens: "density" }),
    F("growth", tr("Crescita", "Growth"), "signed", { unit: tr("variazione 2022→2023", "change 2022→2023"), source: "istat_popolazione", group: "Persone", description: tr("Variazione dei residenti tra il 1° gennaio 2022 e il 1° gennaio 2023 (ISTAT).", "Change in residents between 1 January 2022 and 1 January 2023 (ISTAT).") }),
    ...yieldFields,
  ];
  const yv = (o) => Object.fromEntries((nation.yields || []).map((y) => [`y_${y.key}`, o.yields?.[y.key] ?? null]));

  // --- provinces ("metros": every city is a province) ---------------------------------------------------------
  const metroRows = cities.map((c) => {
    const geo = c.province ?? c.counties?.[0];
    return {
      key: c.id, name: c.name, sub: (c.states || []).join("–"), level: "metros", ref: c, geo,
      v: { name: c.name, province: c.full, states: (c.states || []).join("–"), population: c.population, growth: c.growth ?? null, ...yv(c), ...provVals(geo) },
    };
  });
  const metroByCity = new Map(metroRows.map((r) => [r.ref, r]));
  const fieldsAll = [...baseFields, ...cFields.map((f) => F(f.key, f.label, f.format, { unit: f.unit, higher_is: f.higher_is, source: f.source, description: f.description, lens: LENS_OF[f.key] }))];
  const metros = makeLevel({
    id: "metros", label: tr("Province", "Provinces"), noun: tr("provincia", "province"),
    rows: metroRows,
    fields: [F("name", tr("Città", "City"), "text", { group: "Nome" }), F("province", tr("Provincia", "Province"), "text", { group: "Nome" }), F("states", tr("Regione", "Region"), "text", { group: "Nome" }), ...fieldsAll],
    highlight: (rows, o = {}) => {
      const cells = new Set();
      for (const r of rows) for (const c of r.ref.footprint || [r.ref.cell]) cells.add(c);
      return { cells, cities: rows.length <= (o.ringMax ?? 30) ? new Set(rows.map((r) => r.key)) : undefined };
    },
    rowAtCell: (cell) => { const c = cellMetro.get(cell); return c ? metroByCity.get(c) : null; },
    focus: (row) => app.selectCity(row.ref, { fly: true }),
    cellsOf: (row) => countyCells.get(provIndex.get(row.geo)) || row.ref.footprint || [row.ref.cell],
  });

  // --- regions: sums of counts, population-weighted means of the province measures ----------------------------
  const stateRows = (Array.isArray(states) ? states : []).map((s, idx) => {
    const mine = metroRows.filter((r) => (r.ref.states || []).includes(s.abbr));
    const v = { name: s.name, abbr: s.abbr, population: s.population, growth: s.growth ?? null, ...yv(s) };
    for (const f of cFields) {
      if (f.key === "land_km2") { v[f.key] = mine.reduce((a, r) => a + (r.v.land_km2 || 0), 0) || null; continue; }
      let num = 0, den = 0;
      for (const r of mine) if (fin(r.v[f.key]) && fin(r.v.population)) { num += r.v[f.key] * r.v.population; den += r.v.population; }
      v[f.key] = den ? num / den : null;
    }
    if (fin(v.land_km2) && v.land_km2 > 0) v.density = s.population / v.land_km2;
    v.energy_mw = s.energy ? s.energy.total : null;
    return { key: s.abbr, name: s.name, sub: s.abbr, level: "states", ref: idx, v };
  });
  const states_ = makeLevel({
    id: "states", label: tr("Regioni", "Regions"), noun: tr("regione", "region"),
    rows: stateRows,
    fields: [F("name", tr("Regione", "Region"), "text", { group: "Nome" }), ...fieldsAll.map((f) => (cFields.some((c) => c.key === f.key) && f.key !== "land_km2" && f.key !== "density"
      ? { ...f, label: f.label + " ≈", description: `${f.description} ${tr("Per le regioni: media delle province pesata per popolazione (un'approssimazione).", "For regions: population-weighted mean of the provinces (an approximation).")}`, derived: true } : f))],
    highlight: (rows) => ({ states: new Set(rows.map((r) => r.ref)) }),
    rowAtCell: (cell) => (owner[cell] >= 0 ? stateRows[owner[cell]] || null : null),
    focus: (row) => app.selectState(row.ref, { fly: true }),
    cellsOf: (row) => stateCells.get(row.ref) || [],
  });

  const items = resources?.items || [];
  const typeById = new Map((resources?.types || []).map((t) => [t.id, t]));
  return {
    app, nation, nat, vintage, countyVintage, countiesOffMap: 0,
    levels: { states: states_, metros, counties: null },
    stateCells, countyCells, cellMetro, metroByCity,
    items, typeById,
    source: (id) => srcTitle.get(id) || null,
  };
}

export function shortCounty(name) {
  return String(name || "");
}

function makeLevel(def) {
  const fieldByKey = new Map(def.fields.map((f) => [f.key, f]));
  const byKey = new Map(def.rows.map((r) => [r.key, r]));
  return {
    ...def,
    byKey,
    field: (k) => fieldByKey.get(k) || null,
    value: (row, k) => row.v[k] ?? null,
    numericFields: () => def.fields.filter((f) => f.format !== "text"),
    addFields(list) {
      for (const f of list) {
        if (fieldByKey.has(f.key)) continue;
        def.fields.push(f);
        fieldByKey.set(f.key, f);
      }
    },
  };
}

/** No on-demand files for the Italian advisors: returns the requested files (all null). */
export async function extendData(data, names) {
  return Object.fromEntries(names.map((n) => [n, null]));
}

/** The highlight for a set of rows of one level, with defaults (gold outline, other land dimmed when asked). */
export function rowsHighlight(level, rows, opts = {}) {
  if (!level || !rows || !rows.length) return null;
  const one = rows.length === 1 ? rows[0] : null;
  const label = opts.label ?? (one ? (one.level === "states" ? one.name : `${one.name}${one.sub ? `, ${one.sub}` : ""}`) : "");
  return { ...level.highlight(rows, opts), dimOthers: !!opts.dim, color: opts.color, label };
}
