// Popolazione / People: how many, where, how old, who is growing.
import { makeTopic } from "./topic.js";
import { count3, signedPct, int } from "../core/fmt.js";
import { t } from "../../../i18n.js";

export const { mount } = makeTopic({
  tiles: (d) => [
    { label: t("Residenti", "Residents"), value: count3(d.nat.population), sub: t("ISTAT, 1° gennaio 2023", "ISTAT, 1 January 2023") },
    { label: t("Variazione 2022–2023", "Change 2022–2023"), value: signedPct(d.nat.growth, 2), sub: "ISTAT" },
    { label: t("Province", "Provinces"), value: int(d.levels.metros.rows.length), sub: t(`${d.levels.states.rows.length} regioni`, `${d.levels.states.rows.length} regions`) },
  ],
  map: ["density", "age", "elderly"],
  measures: [
    { key: "growth", title: t("Chi cresce e chi cala", "Who is growing, who is shrinking"), hiTitle: t("Crescono di più", "Fastest growing"), loTitle: t("Calano di più", "Fastest shrinking"), note: t("Variazione dei residenti dal 1° gennaio 2022 al 1° gennaio 2023 (ISTAT).", "Change in residents from 1 January 2022 to 1 January 2023 (ISTAT).") },
    { key: "density", title: t("Densità", "Density"), hiTitle: t("Le più fitte", "Most crowded"), loTitle: t("Le più vuote", "Emptiest") },
    { key: "median_age", title: t("Età mediana", "Median age"), hiTitle: t("Le più anziane", "Oldest"), loTitle: t("Le più giovani", "Youngest") },
    { key: "births", title: t("Natalità", "Birth rate"), hiTitle: t("Più nascite", "Most births"), loTitle: t("Meno nascite", "Fewest births") },
  ],
  scatter: { x: "median_age", y: "births", color: "density", colorLog: true, title: t("Età e nascite", "Age and births"), note: t("Ogni punto è una provincia: età mediana in orizzontale, nati ogni 1.000 abitanti (primo semestre 2020) in verticale; dimensione = popolazione, colore = densità.", "Each dot is a province: median age across, births per 1,000 residents (first half of 2020) up; size = population, colour = density.") },
  sources: ["istat_popolazione", "istat_confini", "qdv2020"],
});
