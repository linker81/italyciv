// Keyboard & mouse cheat-sheet.
import { icon } from "../ui/icon.js";
import { EN, t } from "../i18n.js";

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
const MOD = isMac ? "⌘" : "Ctrl";

const ROWS_IT = [
  ["Muoversi", [
    [["Trascina", "←↑→↓", "WASD"], "Sposta la mappa"],
    [["Rotella", "+", "–"], "Zoom avanti e indietro"],
    [["Doppio clic"], "Zoom su un punto"],
    [["Due dita"], "Pizzica per lo zoom, trascina per spostarti (touch)"],
    [["Minimappa"], "Clicca o trascina per saltare"],
  ]],
  ["Esplorare", [
    [["Clic su città"], "Apri la schermata della città"],
    [["Clic sulla terra"], "Apri quella regione"],
    [["/", `${MOD} K`], "Cerca città e regioni"],
    [["L", "Maiusc L"], "Lente successiva / precedente"],
    [["Legenda"], "Passa sopra la scala o trascinala per mostrare solo quell'intervallo"],
    [["R"], "Mostra o nascondi le risorse"],
  ]],
  ["Pannelli", [
    [["?"], "Questo aiuto"],
    [["Esc"], "Chiude aiuto, ricerca, Almanacco, poi il pannello"],
  ]],
];

const ROWS_EN = [
  ["Move", [
    [["Drag", "←↑→↓", "WASD"], "Pan the map"],
    [["Scroll", "+", "–"], "Zoom in and out"],
    [["Double-click"], "Zoom in on a spot"],
    [["Two fingers"], "Pinch to zoom, drag to pan (touch)"],
    [["Minimap"], "Click or drag to jump"],
  ]],
  ["Explore", [
    [["Click city"], "Open the city screen"],
    [["Click land"], "Open that region"],
    [["/", `${MOD} K`], "Search cities and regions"],
    [["L", "Shift L"], "Next / previous lens"],
    [["Legend"], "Hover or drag the scale to show only that range"],
    [["R"], "Show or hide resources"],
  ]],
  ["Panels", [
    [["?"], "This help"],
    [["Esc"], "Close help, search, Almanac, then the panel"],
  ]],
];

const ROWS = EN ? ROWS_EN : ROWS_IT;

export function initHelp() {
  const modal = document.getElementById("help");
  if (!modal) return { open() {}, close() {}, get isOpen() { return false; } };
  const card = modal.querySelector(".help-card");
  let restore = null;
  card.innerHTML = `
    <button class="icon-btn help-close" data-close aria-label="${t("Chiudi l'aiuto", "Close help")}">${icon("close", "✕", { size: 13 })}</button>
    <h2 id="help-title">${icon("help", "?", { size: 22 })}<span>${t("Comandi", "Controls")}</span></h2>
    <div class="help-cols">${ROWS.map(([title, rows]) => `
      <section><h3>${title}</h3>${rows.map(([keys, what]) => `
        <div class="help-row"><span class="keys">${keys.map((k) => `<kbd>${k}</kbd>`).join("")}</span><span>${what}</span></div>`).join("")}
      </section>`).join("")}</div>
    <p class="help-foot">${t(`Ogni numero risale a dati pubblici: apri l'<b>Almanacco</b> per le fonti.
      Il link nella barra degli indirizzi riapre sempre esattamente questa vista.
      Codice sorgente: <a href="https://github.com/linker81/italyciv/">italiaciv</a> (MIT; adattamento all'Italia di usaciv di Andrej Karpathy, vedi il README).`, `Every number traces back to public data: open the <b>Almanac</b> for sources.
      The link in the address bar always reopens this exact view.
      Source code:<a href="https://github.com/linker81/italyciv/">italiaciv</a> (MIT; an adaptation to Italy of Andrej Karpathy's usaciv, see its README).`)}</p>`;

  const close = () => {
    if (modal.hidden) return;
    modal.hidden = true;
    if (restore && document.contains(restore)) restore.focus();
    restore = null;
  };
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-close]")) close();
  });
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault(); // the only focusable control is the close button
    card.querySelector("[data-close]").focus();
  });

  return {
    open() {
      if (!modal.hidden) return;
      restore = document.activeElement;
      modal.hidden = false;
      card.querySelector("[data-close]").focus();
    },
    close,
    toggle() { modal.hidden ? this.open() : close(); },
    get isOpen() { return !modal.hidden; },
  };
}
