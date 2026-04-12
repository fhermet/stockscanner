import { Stock, SubScore, Explanation, StrategyId } from "../types";

/**
 * Generateur d'explications decouple du scoring.
 *
 * Analyse les metriques d'une action et produit des explications
 * contextualisees selon la strategie.
 */

interface MetricRule {
  readonly metric: string;
  readonly getValue: (stock: Stock) => number | null;
  readonly format: (value: number) => string;
  readonly thresholds: {
    readonly positive: { min: number; text: string };
    readonly neutral?: { min: number; text: string };
    readonly negative: { text: string };
  };
}

const COMMON_RULES: MetricRule[] = [
  {
    metric: "Marge op.",
    getValue: (s) => s.operatingMargin,
    format: (v) => `${v}%`,
    thresholds: {
      positive: { min: 20, text: "Marge operationnelle solide ({value})" },
      neutral: { min: 10, text: "Marge operationnelle correcte ({value})" },
      negative: { text: "Marge operationnelle faible ({value})" },
    },
  },
  {
    metric: "FCF",
    getValue: (s) => s.freeCashFlow,
    format: (v) => `${v} Mds$`,
    thresholds: {
      positive: { min: 0.01, text: "Cash flow positif ({value})" },
      negative: { text: "Cash flow negatif ({value})" },
    },
  },
];

const STRATEGY_RULES: Record<StrategyId, MetricRule[]> = {
  buffett: [
    {
      metric: "ROIC",
      getValue: (s) => s.roic,
      format: (v) => `${v}%`,
      thresholds: {
        positive: { min: 15, text: "ROIC excellent ({value}) : capital bien investi" },
        neutral: { min: 8, text: "ROIC correct ({value})" },
        negative: { text: "ROIC faible ({value}) : rentabilite du capital insuffisante" },
      },
    },
    {
      metric: "PER",
      getValue: (s) => s.per,
      format: (v) => `${v}`,
      thresholds: {
        positive: { min: -Infinity, text: "Valorisation attractive (PER: {value})" },
        neutral: { min: 21, text: "Valorisation raisonnable (PER: {value})" },
        negative: { text: "Valorisation elevee (PER: {value})" },
      },
    },
    {
      metric: "Dette/Cash-flow",
      getValue: (s) => s.debtToOcf,
      format: (v) => `${v}x`,
      thresholds: {
        positive: { min: -Infinity, text: "Endettement maitrise ({value} annees de cash-flow)" },
        neutral: { min: 4.01, text: "Endettement modere ({value} annees de cash-flow)" },
        negative: { text: "Endettement eleve ({value} annees de cash-flow)" },
      },
    },
    {
      metric: "Interest Coverage",
      getValue: (s) => s.interestCoverage ?? null,
      format: (v) => `${v.toFixed(1)}x`,
      thresholds: {
        positive: { min: 8, text: "Couverture des interets confortable ({value})" },
        neutral: { min: 4, text: "Couverture des interets correcte ({value})" },
        negative: { text: "Couverture des interets tendue ({value})" },
      },
    },
    {
      metric: "EV/EBIT",
      getValue: (s) => s.evToEbit ?? null,
      format: (v) => `${v.toFixed(1)}x`,
      thresholds: {
        positive: { min: -Infinity, text: "Valorisation EV/EBIT attractive ({value})" },
        neutral: { min: 18.01, text: "Valorisation EV/EBIT raisonnable ({value})" },
        negative: { text: "Valorisation EV/EBIT elevee ({value})" },
      },
    },
    {
      metric: "ROIC Stabilite",
      getValue: (s) => s.roicStability ?? null,
      format: (v) => `${v.toFixed(1)}%`,
      thresholds: {
        positive: { min: -Infinity, text: "ROIC tres stable ({value} d'ecart-type)" },
        neutral: { min: 6.01, text: "ROIC moderement volatile ({value} d'ecart-type)" },
        negative: { text: "ROIC volatile ({value} d'ecart-type) : rentabilite imprevisible" },
      },
    },
    {
      metric: "Croissance CA 5a",
      getValue: (s) => s.revenueCagr5y ?? null,
      format: (v) => `${v.toFixed(1)}%`,
      thresholds: {
        positive: { min: 8, text: "Croissance du CA reguliere ({value} CAGR 5 ans)" },
        neutral: { min: 3, text: "Croissance du CA moderee ({value} CAGR 5 ans)" },
        negative: { text: "Croissance du CA faible ({value} CAGR 5 ans)" },
      },
    },
  ],
  lynch: [
    {
      metric: "PEG",
      getValue: (s) => s.peg,
      format: (v) => `${v}`,
      thresholds: {
        positive: { min: -Infinity, text: "PEG excellent ({value}) : croissance sous-evaluee" },
        neutral: { min: 1.51, text: "PEG raisonnable ({value})" },
        negative: { text: "PEG eleve ({value}) : croissance deja dans le prix" },
      },
    },
    {
      metric: "EPS Growth",
      getValue: (s) => s.epsGrowth,
      format: (v) => `+${v}%`,
      thresholds: {
        positive: { min: 15, text: "Croissance des benefices forte ({value})" },
        neutral: { min: 5, text: "Croissance des benefices moderee ({value})" },
        negative: { text: "Croissance des benefices faible ({value})" },
      },
    },
    {
      metric: "Dette/Cash-flow",
      getValue: (s) => s.debtToOcf,
      format: (v) => `${v}x`,
      thresholds: {
        positive: { min: -Infinity, text: "Endettement maitrise ({value} annees de cash-flow)" },
        neutral: { min: 4.01, text: "Endettement modere ({value} annees de cash-flow)" },
        negative: { text: "Endettement eleve ({value} annees de cash-flow)" },
      },
    },
  ],
  growth: [
    {
      metric: "CA Growth",
      getValue: (s) => s.revenueGrowth,
      format: (v) => `+${v}%`,
      thresholds: {
        positive: { min: 20, text: "Croissance du CA explosive ({value})" },
        neutral: { min: 10, text: "Croissance du CA solide ({value})" },
        negative: { text: "Croissance du CA insuffisante ({value})" },
      },
    },
    {
      metric: "EPS Growth",
      getValue: (s) => s.epsGrowth,
      format: (v) => `+${v}%`,
      thresholds: {
        positive: { min: 20, text: "Benefices en tres forte hausse ({value})" },
        neutral: { min: 10, text: "Benefices en progression ({value})" },
        negative: { text: "Croissance des benefices limitee ({value})" },
      },
    },
    {
      metric: "ROIC",
      getValue: (s) => s.roic,
      format: (v) => `${v}%`,
      thresholds: {
        positive: { min: 15, text: "ROIC solide ({value}) : capital bien utilise" },
        neutral: { min: 8, text: "ROIC correct ({value})" },
        negative: { text: "ROIC faible ({value})" },
      },
    },
  ],
  dividend: [
    {
      metric: "Div. Yield",
      getValue: (s) => s.dividendYield,
      format: (v) => `${v}%`,
      thresholds: {
        positive: { min: 3, text: "Rendement eleve ({value})" },
        neutral: { min: 1, text: "Rendement correct ({value})" },
        negative: { text: "Rendement faible ou absent ({value})" },
      },
    },
    {
      metric: "Payout Ratio",
      getValue: (s) => s.payoutRatio,
      format: (v) => `${v}%`,
      thresholds: {
        positive: { min: 25, text: "Payout ratio equilibre ({value})" },
        neutral: { min: 70.01, text: "Payout ratio un peu eleve ({value})" },
        negative: { text: "Payout ratio tendu ({value})" },
      },
    },
  ],
};

function evaluateRule(stock: Stock, rule: MetricRule): Explanation | null {
  const value = rule.getValue(stock);
  if (value === null) return null;
  const formatted = rule.format(value);

  // Special handling for inverse metrics (debt, PEG, PER, EV/EBIT, ROIC Stabilite)
  const isInverse = ["Dette/Capitaux", "PEG", "PER", "EV/EBIT", "ROIC Stabilite"].includes(rule.metric);

  const { positive, neutral, negative } = rule.thresholds;

  let type: Explanation["type"];
  let text: string;

  if (isInverse) {
    if (value <= positive.min || (positive.min === -Infinity && value <= (neutral?.min ?? 20))) {
      type = "positive";
      text = positive.text;
    } else if (neutral && value <= (neutral.min + 10)) {
      type = "neutral";
      text = neutral.text;
    } else {
      type = "negative";
      text = negative.text;
    }
  } else {
    if (value >= positive.min) {
      type = "positive";
      text = positive.text;
    } else if (neutral && value >= neutral.min) {
      type = "neutral";
      text = neutral.text;
    } else {
      type = "negative";
      text = negative.text;
    }
  }

  return {
    text: text.replace("{value}", formatted),
    type,
    metric: rule.metric,
    value: formatted,
  };
}

export function generateExplanations(
  stock: Stock,
  _subScores: readonly SubScore[],
  strategyId: StrategyId
): Explanation[] {
  const strategyRules = STRATEGY_RULES[strategyId] ?? [];
  const allRules = [...strategyRules, ...COMMON_RULES];

  return allRules
    .map((rule) => evaluateRule(stock, rule))
    .filter((e): e is Explanation => e !== null);
}

/**
 * Genere un resume naturel en 1-2 phrases.
 *
 * Ex: "Microsoft est une excellente candidate Buffett : marges
 * exceptionnelles, endettement maitrise. Seul bemol : valorisation
 * un peu elevee."
 */
export function generateSummary(
  stock: Stock,
  total: number | null,
  explanations: readonly Explanation[],
  strategyName: string
): string {
  if (total === null) {
    return `${stock.name} : donnees insuffisantes pour calculer un score ${strategyName}.`;
  }

  const positives = explanations.filter((e) => e.type === "positive");
  const negatives = explanations.filter((e) => e.type === "negative");

  let sentiment: string;
  if (total >= 80) sentiment = "excellente candidate";
  else if (total >= 60) sentiment = "bonne candidate";
  else if (total >= 40) sentiment = "candidate moyenne";
  else sentiment = "candidate faible";

  const parts: string[] = [];

  parts.push(
    `${stock.name} est une ${sentiment} ${strategyName} (score ${total}/100)`
  );

  if (positives.length > 0) {
    const topPositives = positives
      .slice(0, 3)
      .map((p) => p.metric)
      .filter(Boolean)
      .join(", ");
    if (topPositives) {
      parts[0] += ` : points forts sur ${topPositives}`;
    }
  }

  parts[0] += ".";

  if (negatives.length > 0) {
    const topNeg = negatives[0];
    if (topNeg.metric) {
      parts.push(
        `Point d'attention : ${topNeg.metric.toLowerCase()} (${topNeg.value}).`
      );
    }
  }

  return parts.join(" ");
}
