// Language: Italian (default) or English. The choice lives in localStorage ("italiaciv.lang") or the URL (?lang=en);
// switching reloads the page, so every module can read LANG once at import time.
//
//   t(it, en)        the string for the current language (write both inline, next to each other)
//   localize(json)   replaces every key `x` that has an `x_en` twin with the twin (English), and drops `*_en` keys;
//                    the data files carry English text that way (pipeline_it writes both)
//   setLang(l)       stores the choice and reloads
const KEY = "italiaciv.lang";

function detect() {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "it" || q === "en") return q;
  } catch { /* no location */ }
  try {
    const s = localStorage.getItem(KEY);
    if (s === "it" || s === "en") return s;
  } catch { /* storage blocked */ }
  return "it";
}

export const LANG = detect();
export const EN = LANG === "en";
export const t = (it, en) => (EN ? en : it);
export const locale = EN ? "en-US" : "it-IT";

export function localize(o) {
  if (Array.isArray(o)) {
    for (let i = 0; i < o.length; i++) o[i] = localize(o[i]);
    return o;
  }
  if (!o || typeof o !== "object") return o;
  for (const k of Object.keys(o)) {
    if (k.endsWith("_en")) continue;
    const v = o[k];
    if (v && typeof v === "object") localize(v);
  }
  for (const k of Object.keys(o)) {
    if (!k.endsWith("_en")) continue;
    const base = k.slice(0, -3);
    if (EN && o[k] != null) o[base] = o[k];
    delete o[k];
  }
  return o;
}

export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
  try {
    const u = new URL(location.href);
    u.searchParams.delete("lang");
    location.replace(u.toString());
  } catch {
    location.reload();
  }
}

// Static texts of index.html (it is written in Italian): [selector, attribute or "text", English].
const STATIC = [
  ["html", "lang", "en"],
  ["title", "text", "italiaciv — Italy as a strategy game"],
  [".brand", "title", "Italy"], [".brand-text", "text", "Italy"],
  ["#yields", "aria-label", "National yields"],
  ["#search-input", "placeholder", "Search cities & regions"], ["#search-input", "aria-label", "Search cities and regions (/ or Ctrl K)"],
  ["#btn-share", "aria-label", "Share this view"], ["#btn-share", "title", "Share: copy a link or download an image"],
  ["#btn-help", "aria-label", "Keyboard and mouse help"], ["#btn-help", "title", "Help (?)"],
  ["#btn-pedia", "aria-label", "Open the Almanac"], ["#btn-pedia", "title", "What every number means and where it comes from"],
  ["#map", "aria-label", "Hex map of Italy"], ["#city-panel", "aria-label", "Details"],
  ["#lens-picker", "aria-label", "Choose a lens"], ["#legend", "aria-label", "Lens legend"], ["#lens-dock", "aria-label", "Map lenses"],
  ["#btn-res", "aria-label", "Resources on tiles (R)"], ["#btn-res", "title", "Show or hide resources on tiles (R)"],
  ["#minimap", "aria-label", "Minimap: click to jump"], ["#btn-minimap", "aria-label", "Show the minimap"],
  ["#search-results", "aria-label", "Search results"], ["#share-pop", "aria-label", "Share"], ["#yield-report", "aria-label", "National report"],
  ["#pedia .modal-card", "aria-label", "Almanac"], ["#pedia [data-close]", "aria-label", "Close the Almanac"], ["#pedia-nav", "aria-label", "Almanac pages"],
  ["#loading", "text", "Surveying the land…"],
];

export function applyStatic() {
  if (!EN || typeof document === "undefined") return;
  for (const [sel, attr, val] of STATIC) {
    for (const el of document.querySelectorAll(sel)) {
      if (attr === "text") el.textContent = val;
      else el.setAttribute(attr, val);
    }
  }
}
applyStatic();

/** The IT | EN switch for the top bar. */
export function langSwitch() {
  const b = document.createElement("div");
  b.className = "lang-switch";
  b.setAttribute("role", "group");
  b.setAttribute("aria-label", t("Lingua", "Language"));
  b.innerHTML = ["it", "en"].map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === LANG}" title="${l === "it" ? "Italiano" : "English"}">${l.toUpperCase()}</button>`).join("");
  b.addEventListener("click", (e) => {
    const l = e.target.closest("[data-lang]")?.dataset.lang;
    if (l && l !== LANG) setLang(l);
  });
  return b;
}

/** The decimal separator: `x.toFixed(1).replace(".", DEC)`. */
export const DEC = EN ? "." : ",";
