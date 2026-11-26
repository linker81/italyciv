// Conoscenza / Knowledge: education, young people, fibre and innovation.
import { makeTopic } from "./topic.js";
import { pct, count3 } from "../core/fmt.js";
import { t } from "../../../i18n.js";

export const { mount } = makeTopic({
  tiles: (d) => [
    { label: t("Diplomati", "Diploma holders"), value: count3(d.nat.yields?.science), sub: t("25-64 anni con almeno il diploma", "aged 25-64 with at least a diploma") },
    { label: t("Quota", "Share"), value: pct(d.nat.yields?.science / d.levels.metros.rows.reduce((a, r) => a + (r.v.y_science && r.v.bachelors ? r.v.y_science / r.v.bachelors : 0), 0)), sub: t("dei 25-64enni", "of people aged 25-64") },
  ],
  map: ["bachelors", "neet", "broadband", "startups"],
  measures: [
    { key: "bachelors", title: t("Persone con almeno il diploma", "People with at least a diploma") },
    { key: "neet", title: t("Giovani che non studiano e non lavorano (NEET)", "Young people not in education or work (NEET)"), hiTitle: t("Meno NEET", "Fewest NEETs"), loTitle: t("Più NEET", "Most NEETs") },
    { key: "broadband", title: t("Fibra fino a casa (FTTH)", "Fibre to the home (FTTH)") },
    { key: "startups", title: t("Startup innovative", "Innovative startups") },
    { key: "libraries", title: t("Biblioteche", "Libraries") },
  ],
  scatter: { x: "bachelors", y: "neet", color: "income", title: t("Diplomati e NEET", "Diplomas and NEETs"), note: t("Ogni punto è una provincia: quota di diplomati in orizzontale, quota di NEET in verticale; colore = reddito pro capite.", "Each dot is a province: share with a diploma across, share of NEETs up; colour = income per person.") },
});
