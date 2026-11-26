// The Almanac: what every number means and exactly where it comes from.
import { DEC, locale, EN, t } from "../i18n.js";
import { resolveTables } from "../terrain.js";
import { esc } from "../format.js";
import { parseHex, luminance } from "../color.js";
import { icon, glyph } from "./icon.js";

const COVER_ICON = { forest_deciduous: "l-forest", forest_evergreen: "l-forest", forest_mixed: "l-forest", cropland: "l-farmland", pasture: "l-farmland", urban: "l-developed" };
// Glyph colour that reads on a resource medallion (dark on light faces such as nuclear yellow or silver).
const inkOn = (hex) => {
  try { return /^#[0-9a-f]{6}$/i.test(hex || "") && luminance(parseHex(hex)) > 0.4 ? "#1c1710" : "#f8f0d8"; } catch { return "#f8f0d8"; }
};
const CATEGORY = { energy: "Energia", mineral: "Minerali", agri: "Agricoltura" };
const CATEGORY_EN = { energy: "Energy", mineral: "Minerals", agri: "Agriculture" };
// Italian page names → English ones (callers open pages by their Italian name).
const ALIAS = { "Questa mappa": "About this map", Rese: "Yields", Regioni: "Regions", Terreno: "Terrain", Lenti: "Lenses", Risorse: "Resources", Fonti: "Sources" };

export function initPedia(data) {
  const modal = document.getElementById("pedia");
  const card = modal.querySelector(".modal-card");
  const nav = document.getElementById("pedia-nav");
  const body = document.getElementById("pedia-body");
  const srcName = (id) => data.sources?.find((s) => s.id === id)?.title || id || "";
  let restoreFocus = null;

  const h2 = (ic, fb, text) => `<h2>${icon(ic, fb, { size: 24 })}<span>${esc(text)}</span></h2>`;

  const pages = {
    "Questa mappa": () => `
      ${h2("pedia", "📖", "Questa mappa")}
      <p>Questa è l'Italia vera, disegnata come un gioco di strategia. Ogni esagono, città e numero viene da dati pubblici,
      elencati in <i>Fonti</i>. Le poche cose stimate o scelte a mano sono dichiarate dove compaiono.</p>
      <p>È un adattamento all'Italia di <i>usaciv</i> di Andrej Karpathy, la stessa idea applicata agli Stati Uniti.</p>
      <h4>Come è costruita</h4>
      <p>L'Italia è proiettata (conica equivalente di Albers, paralleli standard 38° e 46° N) e divisa in
      ${data.world.grid.cols}×${data.world.grid.rows} esagoni, ognuno di ${data.world.grid.radius * 2} km da vertice a vertice
      (circa ${Math.round(data.world.grid.radius * data.world.grid.radius * 2.598)} km²). Ogni esagono appartiene alla regione e
      alla provincia che coprono la maggior parte dei suoi 7 punti campione.</p>
      <p><b>Città</b>: le 107 province (e città metropolitane) del 2023, ognuna con il nome e la posizione del suo capoluogo.
      I numeri di una città sono quelli dell'<b>intera provincia</b>: è il livello a cui sono pubblicate quasi tutte le statistiche
      usate qui, ed è il più vicino alle aree metropolitane della versione americana.</p>
      <h4>Comandi</h4>
      <p>Trascina o usa le frecce / WASD per spostarti · rotella, +/– o doppio clic per lo zoom · clicca una città o una regione
      per aprirla · / o ⌘K per cercare · L per scorrere le lenti · R per mostrare o nascondere le risorse · ? per tutte le
      scorciatoie · Esc per chiudere. Il selettore IT | EN nella barra in alto cambia la lingua.</p>
      <p>La barra degli indirizzi contiene sempre il link a ciò che stai guardando (lente, selezione e vista); usa
      <i>Condividi</i> per copiarlo o per scaricare un'immagine.</p>`,
    Rese: () => `
      ${h2("y-production", "⚙️", "Rese")}
      <p>Le rese di Civilization associate a misure reali, tutte <i>conteggi</i> per provincia (così si possono sommare per
      regione e per l'Italia). Non esistendo qui dati sull'occupazione per settore, ogni resa usa la misura più vicina
      disponibile: la descrizione dice esattamente quale. <b>L'Oro non è il PIL</b> ma il reddito disponibile delle famiglie.</p>
      <table>${data.nation.yields.map((y) => `<tr><td class="ic" style="color:${esc(y.color)}">${glyph(y, 26)}</td><td><b style="color:${esc(y.color)}">${esc(y.label)}</b><br>${esc(y.description)}</td></tr>`).join("")}</table>
      <p class="muted">Le quote e i tassi sono del 2019-2020 (Qualità della vita 2020), la popolazione del 2023: i conteggi
      mescolano quindi anni diversi.</p>
      <h4>Benessere e casa</h4>
      <p>Tasso di occupazione: occupati di 15-64 anni sulla popolazione della stessa età (ISTAT 2019). Prezzi delle case e
      affitti sono quelli di un appartamento nuovo di 100 m² in zona semicentrale <i>nel capoluogo</i> (Scenari Immobiliari,
      ottobre 2020), non la media della provincia.</p>`,
    Regioni: () => `
      ${h2("terrain", "🗺️", "Regioni")}
      <p>Clicca un esagono senza città per aprire la sua regione. I numeri di una regione sono la somma (o la media pesata per
      popolazione) delle sue province.</p>
      <p>Le <b>posizioni</b> («3ª su 20») confrontano le 20 regioni; 1 è la più grande. Il Trentino-Alto Adige è una regione
      sola, con le due province autonome di Trento e Bolzano.</p>
      <p>San Marino e la Città del Vaticano sono stati esteri: sono troppo piccoli per avere un esagono.</p>
      ${data.states ? "" : `<p class="muted">Questi dati non hanno states.json: i pannelli delle regioni mostrano solo nomi e città.</p>`}`,
    Terreno: () => {
      const t = data.w?.tables || resolveTables(data.world.tables);
      const hasCover = Array.isArray(data.world.cover);
      const notes = data.world.tables?.notes || {};
      const row = (x) => `<tr><td class="nm">${x.color ? `<span class="swatch" style="background:${esc(x.color)}"></span>` : ""}${
        COVER_ICON[x.key] ? icon(COVER_ICON[x.key], "", { size: 15 }) + " " : ""}<b>${esc(x.name)}</b></td><td>${esc(x.rule || "")}</td></tr>`;
      return `
      ${h2("terrain", "🗺️", "Terreno")}
      <p>Ogni esagono fa la media delle quote dentro di sé. Il rilievo viene dalla quota media e dalla rugosità (deviazione
      standard) di quei campioni; l'ombreggiatura dalle differenze di quota con gli esagoni vicini, illuminati da nord-ovest.</p>
      <p class="muted">${esc(notes.relief || "")}</p>
      <h4>${icon("l-forest", "🌲", { size: 16 })} Copertura del suolo</h4>
      ${hasCover
        ? `<p><b>${esc(notes.cover || "")}</b></p>
           <table>${t.cover.filter((x) => x.id > 0).map(row).join("")}</table>`
        : `<p class="muted">Questi dati non hanno la copertura del suolo; la terra è colorata per quota.</p>`}
      <h4>Rilievo</h4>
      <table>${t.relief.map(row).join("")}</table>
      <h4>${icon("r-hydro", "💧", { size: 16 })} Acque</h4>
      <p class="muted">${esc(notes.water || "")}</p>
      <table>${t.water.filter((x) => x.id > 0).map(row).join("")}</table>
      <h4>Oltre i confini</h4>
      <p class="muted">Le terre straniere (Francia, Svizzera, Austria, Slovenia, Croazia, la Corsica, Malta, la Tunisia…)
      sono disegnate sotto una leggera nebbia: servono da contesto e non sono mappate in dettaglio.</p>`;
    },
    Lenti: () => `
      ${h2("layers", "▤", "Lenti")}
      <p>Le lenti ricolorano la mappa secondo una misura, costruita dai dati delle province (${esc(data.lenses.vintage)}). Ogni
      esagono è campionato in 7 punti: il valore dell'esagono è la media dei valori delle province in quei punti. La lente
      Popolazione usa invece la densità dei singoli comuni, quindi mostra le città dentro le province.</p>
      <p>La legenda mostra quanti esagoni cadono su ogni valore. Passaci sopra o trascina per mostrare solo quell'intervallo.</p>
      ${(data.lenses.groups || [{ id: null, name: "" }]).map((g) => {
        const ls = data.lenses.lenses.filter((l) => !g.id || l.group === g.id);
        if (!ls.length) return "";
        return `${g.name ? `<h3 class="grp">${icon(`g-${g.id}`, "", { size: 16 })} ${esc(g.name)}</h3>` : ""}${ls.map((l) => `
          <div class="lens-entry"><div class="le-ic">${glyph(l, 26)}</div><div>
          <h4>${esc(l.name)}</h4><p>${esc(l.description)}${l.note ? `<br><i>${esc(l.note)}</i>` : ""}<br>
          <i class="le-ramp" style="background:linear-gradient(90deg, ${(l.ramp || []).map(esc).join(",")})"></i>
          <span class="muted">Scala: ${l.scale === "log" ? "logaritmica" : "lineare"}, ${l.domain[0].toLocaleString(locale)}–${l.domain[1].toLocaleString(locale)} ${esc(l.unit)}${
            l.higher_is === "good" ? " · più alto è meglio" : l.higher_is === "bad" ? " · più alto è peggio" : ""}${l.source ? " · " + esc(srcName(l.source)) : ""}</span></p></div></div>`).join("")}`;
      }).join("")}`,
    Risorse: () => {
      const r = data.resources;
      if (!r?.types?.length) return `${h2("resources", "⛏️", "Risorse")}<p class="muted">Questi dati non hanno il livello delle risorse.</p>`;
      const count = new Map();
      for (const it of r.items || []) count.set(it.type, (count.get(it.type) || 0) + 1);
      const cats = [...new Set(r.types.map((t) => t.category || "other"))];
      return `
      ${h2("resources", "⛏️", "Risorse")}
      <p>Le risorse segnano le centrali elettriche più grandi del paese sugli esagoni dove si trovano. Sono mostrati solo
      gli impianti significativi: la soglia di ogni tipo è nella sua descrizione. Da lontano un esagono mostra la sua risorsa
      più importante; avvicinati per vederne di più. Premi <b>R</b> per mostrarle o nasconderle.</p>
      ${cats.map((c) => `<h4>${esc(CATEGORY[c] || c)}</h4><table class="res-table">
        <tr><th></th><th>Tipo</th><th>Che cosa conta</th><th>Siti</th></tr>
        ${r.types.filter((t) => (t.category || "other") === c).map((t) => `<tr>
          <td class="ic"><span class="res-ic" style="background:${esc(t.color || "#24384f")};color:${inkOn(t.color)}">${glyph(t, 20)}</span></td>
          <td class="nm"><b>${esc(t.name)}</b>${t.unit ? `<br><span class="muted">valore in ${esc(t.unit)}</span>` : ""}</td>
          <td>${esc(t.description || "")}<br><span class="muted">Fonte: ${esc(srcName(t.source))}</span></td>
          <td class="num">${count.get(t.id) || 0}</td></tr>`).join("")}</table>`).join("")}`;
    },
    Fonti: () => `
      ${h2("pedia", "📖", "Fonti")}
      ${data.sources.map((s) => `
        <h4>${esc(s.title)}</h4>
        <p>${esc(s.description)}<br>
        <span class="muted">${esc(s.publisher)} · ${esc(s.license)}${s.vintage ? " · " + esc(s.vintage) : ""} ·
        <a href="${esc(s.homepage)}" target="_blank" rel="noopener">sito</a></span></p>
        <table>${(s.files || []).map((f) => `<tr><td><code>${esc(f.url)}</code>${f.sha256 ? `<br><span class="muted">sha256 ${esc(f.sha256.slice(0, 16))}…</span>` : ""}</td><td class="muted" style="white-space:nowrap">${esc((f.retrieved || "").slice(0, 10))}<br>${f.bytes ? ((f.bytes || 0) / 1e6).toFixed(1).replace(".", DEC) + " MB" : ""}</td></tr>`).join("")}</table>`).join("")}`,
  };

  const pagesEN = {
    "About this map": () => `
      ${h2("pedia", "📖", "About this map")}
      <p>This is the real Italy, drawn like a strategy game. Every hex, city and number comes from public data, listed
      under <i>Sources</i>. The few things that are estimated or picked by hand are said so where they appear.</p>
      <p>It is an adaptation to Italy of Andrej Karpathy's <i>usaciv</i>, the same idea applied to the United States.</p>
      <h4>How it's built</h4>
      <p>Italy is projected (Albers equal-area conic, standard parallels 38° and 46° N) and cut into
      ${data.world.grid.cols}×${data.world.grid.rows} hexes, each ${data.world.grid.radius * 2} km corner to corner
      (about ${Math.round(data.world.grid.radius * data.world.grid.radius * 2.598)} km²). Each hex belongs to the region and
      province that cover most of its 7 sample points.</p>
      <p><b>Cities</b> are the 107 provinces (and metropolitan cities) of 2023, each with the name and position of its capital.
      A city's numbers are those of the <b>whole province</b>: that is the level almost every statistic used here is published
      at, and the closest thing to the metro areas of the American version.</p>
      <h4>Controls</h4>
      <p>Drag or arrow keys / WASD to pan · scroll, +/– or double-click to zoom · click a city or a region to open it ·
      / or ⌘K to search · L to cycle lenses · R to show or hide resources · ? for all shortcuts · Esc to close.
      The IT | EN switch in the top bar changes the language.</p>
      <p>The address bar always holds a link to what you're looking at (lens, selection and view); use <i>Share</i> to copy it
      or to download a picture.</p>`,
    Yields: () => `
      ${h2("y-production", "⚙️", "Yields")}
      <p>Civilization's yields mapped onto real measures, all of them <i>counts</i> per province (so they add up to regions and
      to Italy). There are no jobs-by-industry figures here, so each yield uses the closest measure available: its description
      says exactly which. <b>Gold is not GDP</b> but households' disposable income.</p>
      <table>${data.nation.yields.map((y) => `<tr><td class="ic" style="color:${esc(y.color)}">${glyph(y, 26)}</td><td><b style="color:${esc(y.color)}">${esc(y.label)}</b><br>${esc(y.description)}</td></tr>`).join("")}</table>
      <p class="muted">Shares and rates are from 2019-2020 (Qualità della vita 2020), population from 2023: the counts mix
      different years.</p>
      <h4>Prosperity &amp; housing</h4>
      <p>Employment rate: employed people aged 15-64 over the population of that age (ISTAT 2019). Home prices and rents are
      those of a new 100 m² flat in a semi-central area <i>of the provincial capital</i> (Scenari Immobiliari, October 2020),
      not the province average.</p>`,
    Regions: () => `
      ${h2("terrain", "🗺️", "Regions")}
      <p>Click any land hex without a city to open its region. A region's numbers are the sum (or the population-weighted
      mean) of its provinces.</p>
      <p><b>Ranks</b> ("#3 of 20") compare the 20 regions; 1 is the largest. Trentino-Alto Adige is a single region made of
      the two autonomous provinces of Trento and Bolzano.</p>
      <p>San Marino and Vatican City are foreign states, too small to hold a hex.</p>
      ${data.states ? "" : `<p class="muted">This data build has no states.json, so region panels show names and cities only.</p>`}`,
    Terrain: () => {
      const tb = data.w?.tables || resolveTables(data.world.tables);
      const hasCover = Array.isArray(data.world.cover);
      const notes = data.world.tables?.notes || {};
      const row = (x) => `<tr><td class="nm">${x.color ? `<span class="swatch" style="background:${esc(x.color)}"></span>` : ""}${
        COVER_ICON[x.key] ? icon(COVER_ICON[x.key], "", { size: 15 }) + " " : ""}<b>${esc(x.name)}</b></td><td>${esc(x.rule || "")}</td></tr>`;
      return `
      ${h2("terrain", "🗺️", "Terrain")}
      <p>Each hex averages the elevation inside it. Relief comes from the mean elevation and roughness (standard deviation)
      of those samples; shading comes from elevation differences with neighbouring hexes, lit from the north-west.</p>
      <p class="muted">${esc(notes.relief || "")}</p>
      <h4>${icon("l-forest", "🌲", { size: 16 })} Land cover</h4>
      ${hasCover
        ? `<p><b>${esc(notes.cover || "")}</b></p>
           <table>${tb.cover.filter((x) => x.id > 0).map(row).join("")}</table>`
        : `<p class="muted">This data build has no land cover; land is coloured by elevation.</p>`}
      <h4>Relief</h4>
      <table>${tb.relief.map(row).join("")}</table>
      <h4>${icon("r-hydro", "💧", { size: 16 })} Water</h4>
      <p class="muted">${esc(notes.water || "")}</p>
      <table>${tb.water.filter((x) => x.id > 0).map(row).join("")}</table>
      <h4>Beyond the borders</h4>
      <p class="muted">Foreign land (France, Switzerland, Austria, Slovenia, Croatia, Corsica, Malta, Tunisia…) is drawn under
      a light fog: it is shown for context and not mapped in detail.</p>`;
    },
    Lenses: () => `
      ${h2("layers", "▤", "Lenses")}
      <p>Lenses recolour the map by one measure, built from province data (${esc(data.lenses.vintage)}). Each hex is sampled
      at 7 points: its value is the mean of the provinces' values at those points. The Population lens uses the density of
      each municipality instead, so it shows the towns inside the provinces.</p>
      <p>The legend shows how many hexes fall at each value. Hover or drag on it to show only that range on the map.</p>
      ${(data.lenses.groups || [{ id: null, name: "" }]).map((g) => {
        const ls = data.lenses.lenses.filter((l) => !g.id || l.group === g.id);
        if (!ls.length) return "";
        return `${g.name ? `<h3 class="grp">${icon(`g-${g.id}`, "", { size: 16 })} ${esc(g.name)}</h3>` : ""}${ls.map((l) => `
          <div class="lens-entry"><div class="le-ic">${glyph(l, 26)}</div><div>
          <h4>${esc(l.name)}</h4><p>${esc(l.description)}${l.note ? `<br><i>${esc(l.note)}</i>` : ""}<br>
          <i class="le-ramp" style="background:linear-gradient(90deg, ${(l.ramp || []).map(esc).join(",")})"></i>
          <span class="muted">Scale: ${l.scale}, ${l.domain[0].toLocaleString(locale)}–${l.domain[1].toLocaleString(locale)} ${esc(l.unit)}${
            l.higher_is === "good" ? " · higher is better" : l.higher_is === "bad" ? " · higher is worse" : ""}${l.source ? " · " + esc(srcName(l.source)) : ""}</span></p></div></div>`).join("")}`;
      }).join("")}`,
    Resources: () => {
      const r = data.resources;
      if (!r?.types?.length) return `${h2("resources", "⛏️", "Resources")}<p class="muted">This data build has no resources layer.</p>`;
      const count = new Map();
      for (const it of r.items || []) count.set(it.type, (count.get(it.type) || 0) + 1);
      const cats = [...new Set(r.types.map((x) => x.category || "other"))];
      return `
      ${h2("resources", "⛏️", "Resources")}
      <p>Resources mark the country's biggest power plants on the hexes where they are. Only meaningful sites are shown:
      each type's threshold is in its description. Zoomed out, a hex shows its highest-ranked resource; zoom in to see more.
      Press <b>R</b> to show or hide them.</p>
      ${cats.map((c) => `<h4>${esc(CATEGORY_EN[c] || c)}</h4><table class="res-table">
        <tr><th></th><th>Type</th><th>What counts</th><th>Sites</th></tr>
        ${r.types.filter((x) => (x.category || "other") === c).map((x) => `<tr>
          <td class="ic"><span class="res-ic" style="background:${esc(x.color || "#24384f")};color:${inkOn(x.color)}">${glyph(x, 20)}</span></td>
          <td class="nm"><b>${esc(x.name)}</b>${x.unit ? `<br><span class="muted">value in ${esc(x.unit)}</span>` : ""}</td>
          <td>${esc(x.description || "")}<br><span class="muted">Source: ${esc(srcName(x.source))}</span></td>
          <td class="num">${count.get(x.id) || 0}</td></tr>`).join("")}</table>`).join("")}`;
    },
    Sources: () => `
      ${h2("pedia", "📖", "Sources")}
      ${data.sources.map((s) => `
        <h4>${esc(s.title)}</h4>
        <p>${esc(s.description)}<br>
        <span class="muted">${esc(s.publisher)} · ${esc(s.license)}${s.vintage ? " · " + esc(s.vintage) : ""} ·
        <a href="${esc(s.homepage)}" target="_blank" rel="noopener">homepage</a></span></p>
        <table>${(s.files || []).map((f) => `<tr><td><code>${esc(f.url)}</code>${f.sha256 ? `<br><span class="muted">sha256 ${esc(f.sha256.slice(0, 16))}…</span>` : ""}</td><td class="muted" style="white-space:nowrap">${esc((f.retrieved || "").slice(0, 10))}<br>${f.bytes ? ((f.bytes || 0) / 1e6).toFixed(1) + " MB" : ""}</td></tr>`).join("")}</table>`).join("")}`,
  };
  const pagesIT = pages;
  const P = EN ? pagesEN : pagesIT;
  const HOME = EN ? "About this map" : "Questa mappa";

  const show = (name) => {
    if (EN && ALIAS[name]) name = ALIAS[name];
    if (!P[name]) name = HOME;
    body.innerHTML = P[name]();
    body.scrollTop = 0;
    nav.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.page === name;
      b.classList.toggle("active", on);
      b.setAttribute("aria-current", on ? "page" : "false");
    });
  };
  nav.innerHTML = `<div class="hd">${t("Almanacco", "Almanac")}</div>` + Object.keys(P).map((p) => `<button data-page="${esc(p)}">${esc(p)}</button>`).join("");
  nav.onclick = (e) => {
    const b = e.target.closest("button[data-page]");
    if (b) show(b.dataset.page);
  };
  const close = () => {
    if (modal.hidden) return;
    modal.hidden = true;
    if (restoreFocus && document.contains(restoreFocus)) restoreFocus.focus();
    restoreFocus = null;
  };
  modal.onclick = (e) => {
    if (e.target === modal || e.target.closest("[data-close]")) close();
  };
  // Keep Tab inside the dialog.
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [...card.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])")].filter((x) => x.offsetParent);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  return {
    open(page = HOME) {
      if (modal.hidden) restoreFocus = document.activeElement;
      show(page);
      modal.hidden = false;
      (nav.querySelector("button.active") || card.querySelector("[data-close]"))?.focus();
    },
    close,
    get isOpen() {
      return !modal.hidden;
    },
  };
}
