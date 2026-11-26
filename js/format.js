// Number formatting in the current language (js/i18n.js). Italian: decimal comma, dot for thousands,
// "mila / mln / mld". English: decimal point, comma for thousands, K / M / B. Money is always in euro.
import { EN } from "./i18n.js";

const dec = (v, d) => (EN ? v.toFixed(d) : v.toFixed(d).replace(".", ","));
// Thousands separator even for 4-digit numbers (Intl's it-IT leaves "4250" ungrouped).
const group = (n) => {
  const r = Math.round(n);
  return (r < 0 ? "−" : "") + String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, EN ? "," : ".");
};
const strip0 = (s) => s.replace(/[.,]0$/, "");
const U = EN ? { k: "K", m: "M", b: "B", sp: "" } : { k: " mila", m: " mln", b: " mld", sp: " " };

export function compact(n) {
  if (n == null || Number.isNaN(n)) return "–";
  const a = Math.abs(n);
  if (EN) {
    if (a >= 1e12) return (n / 1e12).toFixed(a >= 1e13 ? 1 : 2) + "T";
    if (a >= 1e9) return strip0((n / 1e9).toFixed(a >= 1e11 ? 0 : 1)) + "B";
    if (a >= 1e6) return strip0((n / 1e6).toFixed(a >= 1e8 ? 0 : 1)) + "M";
    if (a >= 1e4) return strip0((n / 1e3).toFixed(a >= 1e5 ? 0 : 1)) + "K";
    return group(n);
  }
  if (a >= 1e12) return group(n / 1e9) + " mld";
  if (a >= 1e9) return strip0(dec(n / 1e9, a >= 1e11 ? 0 : 1)) + " mld";
  if (a >= 1e6) return strip0(dec(n / 1e6, a >= 1e8 ? 0 : 1)) + " mln";
  if (a >= 1e4) return strip0(dec(n / 1e3, a >= 1e5 ? 0 : 1)) + " mila";
  return group(n);
}

export { dec, group, U };
export const money = (n) => (n == null ? "–" : "€" + compact(n));
export const dollars = (n) => (n == null ? "–" : "€" + group(n));
export const euros = dollars;
export const int = (n) => (n == null ? "–" : group(n));
export const pct = (x, d = 1) => (x == null ? "–" : dec(x * 100, d) + "%");
export const num = (x, d = 1) => (x == null ? "–" : dec(x, d));

export function yieldValue(y, v) {
  return y.unit === "usd" ? money(v) : compact(v);
}

export function popShort(n) {
  if (EN) {
    if (n >= 1e7) return Math.round(n / 1e6) + "M";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    return Math.round(n / 1e3) + "K";
  }
  if (n >= 1e7) return Math.round(n / 1e6) + " mln";
  if (n >= 1e6) return dec(n / 1e6, 1) + " mln";
  return Math.round(n / 1e3) + " mila";
}

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
