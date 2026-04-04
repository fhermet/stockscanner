import { Strategy, StrategyId } from "./types";

export const STRATEGIES: readonly Strategy[] = [
  {
    id: "buffett",
    name: "Buffett",
    subtitle: "Qualite & valeur",
    description:
      "Identifie les entreprises de qualite avec un avantage competitif durable, une rentabilite forte et une valorisation raisonnable.",
    philosophy:
      "Acheter de merveilleuses entreprises a un prix raisonnable, plutot que des entreprises mediocres a prix brade.",
    icon: "shield",
    color: "indigo",
  },
  {
    id: "lynch",
    name: "Peter Lynch",
    subtitle: "Croissance a prix raisonnable",
    description:
      "Trouve les entreprises en croissance dont le prix reste raisonnable par rapport a leur potentiel de benefices.",
    philosophy:
      "Investir dans ce que l'on comprend. Le PEG est la cle : une croissance solide a un prix sense.",
    icon: "trending-up",
    color: "emerald",
  },
  {
    id: "growth",
    name: "Growth",
    subtitle: "Croissance agressive",
    description:
      "Cible les entreprises a forte croissance de revenus et de benefices, avec un momentum fondamental fort.",
    philosophy:
      "Miser sur les entreprises qui capturent des marches en expansion rapide, meme si la valorisation est elevee.",
    icon: "rocket",
    color: "violet",
  },
  {
    id: "dividend",
    name: "Dividende",
    subtitle: "Rendement & stabilite",
    description:
      "Selectionne les entreprises offrant un dividende attractif, soutenable et en croissance.",
    philosophy:
      "Privilegier les revenus reguliers et la preservation du capital grace a des dividendes fiables et bien couverts.",
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
