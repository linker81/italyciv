// Benessere e casa / Prosperity & housing: incomes, jobs, homes and rents, who is left behind.
import { makeTopic } from "./topic.js";
import { dollars, pct } from "../core/fmt.js";
import { t } from "../../../i18n.js";

export const { mount } = makeTopic({
  tiles: (d) => [
    { label: t("Reddito pro capite", "Income per person"), value: dollars(d.nat.median_income), sub: t("disponibile, 2019", "disposable, 2019") },
    { label: t("Tasso di occupazione", "Employment rate"), value: pct(d.nat.employment_rate), sub: t("15-64 anni, 2019", "aged 15-64, 2019") },
    { label: t("Prezzo case (capoluoghi)", "Home prices (capitals)"), value: `${dollars(d.nat.home_value)}/m²`, sub: t("media pesata, 2020", "weighted mean, 2020") },
  ],
  map: ["income", "employment", "home_value", "rdc"],
  measures: [
    { key: "income", title: t("Reddito disponibile pro capite", "Disposable income per person"), hiTitle: t("Le più ricche", "Richest"), loTitle: t("Le meno ricche", "Least rich") },
    { key: "employment", title: t("Tasso di occupazione", "Employment rate") },
    { key: "rdc", title: t("Reddito di cittadinanza", "Citizens' income (welfare)"), hiTitle: t("Più assegni", "Most payments"), loTitle: t("Meno assegni", "Fewest payments") },
    { key: "home_value", title: t("Prezzo delle case nel capoluogo", "Home prices in the capital"), hiTitle: t("Le più care", "Most expensive"), loTitle: t("Le meno care", "Cheapest") },
    { key: "rent", title: t("Affitti nel capoluogo", "Rents in the capital"), hiTitle: t("Le più care", "Most expensive"), loTitle: t("Le meno care", "Cheapest") },
  ],
  scatter: { x: "income", y: "home_value", color: "employment", title: t("Reddito e prezzo delle case", "Income and home prices"), note: t("Ogni punto è una provincia: reddito pro capite in orizzontale, prezzo al m² nel capoluogo in verticale; colore = tasso di occupazione.", "Each dot is a province: income per person across, price per m² in the capital up; colour = employment rate.") },
  caveats: [t("Prezzi e affitti sono quelli di un appartamento nuovo di 100 m² in zona semicentrale del capoluogo (Scenari Immobiliari), non la media della provincia.", "Prices and rents are those of a new 100 m² flat in a semi-central area of the provincial capital (Scenari Immobiliari), not the province average.")],
});
