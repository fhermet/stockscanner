import { Strategy, StrategyId } from "./types";

export const STRATEGIES: readonly Strategy[] = [
  {
    id: "buffett",
    name: "Warren Buffett",
    subtitle: "Qualité & valeur",
    description:
      "Identifie les entreprises de qualité avec un avantage compétitif durable, une rentabilité forte et une valorisation raisonnable.",
    philosophy:
      "Acheter de merveilleuses entreprises à un prix raisonnable, plutôt que des entreprises médiocres à prix bradé.",
    icon: "shield",
    color: "indigo",
  },
  {
    id: "lynch",
    name: "Peter Lynch",
    subtitle: "Croissance à prix raisonnable",
    description:
      "Trouve les entreprises en croissance dont le prix reste raisonnable par rapport à leur potentiel de bénéfices.",
    philosophy:
      "Investir dans ce que l'on comprend. Le PEG est la clé : une croissance solide à un prix sensé.",
    icon: "trending-up",
    color: "emerald",
  },
  {
    id: "growth",
    name: "Growth",
    subtitle: "Croissance agressive",
    description:
      "Cible les entreprises à forte croissance de revenus et de bénéfices, avec un momentum fondamental fort.",
    philosophy:
      "Miser sur les entreprises qui capturent des marchés en expansion rapide, même si la valorisation est élevée.",
    icon: "rocket",
    color: "violet",
  },
  {
    id: "dividend",
    name: "Dividende",
    subtitle: "Rendement & stabilité",
    description:
      "Sélectionne les entreprises offrant un dividende attractif, soutenable et en croissance.",
    philosophy:
      "Privilégier les revenus réguliers et la préservation du capital grâce à des dividendes fiables et bien couverts.",
    icon: "banknotes",
    color: "amber",
  },
] as const;

export function getStrategy(id: StrategyId): Strategy {
  const strategy = STRATEGIES.find((s) => s.id === id);
  if (!strategy) {
    throw new Error(`Unknown strategy: ${id}`);
  }
  return strategy;
}

export function isValidStrategyId(id: string): id is StrategyId {
  return ["buffett", "lynch", "growth", "dividend"].includes(id);
}
