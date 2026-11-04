/**
 * Topic tones: each topic has one color, used by its section rail, its cards
 * and its charts on every tab. Variables keep the tone of their topic, so a
 * variable looks the same on "Hoy", "Panel" and "Histórico".
 */
export type Tone = "dollars" | "pressure" | "risk" | "money" | "inflation" | "rates" | "indexes";

export const toneVar = (tone: Tone) => `var(--tone-${tone})`;

/** Tone of each history variable. Activity reuses the amber of "pressure": no eighth hue passed the palette checks. */
export const VARIABLE_TONES: Record<string, Tone> = {
  blue: "dollars",
  oficial: "dollars",
  mep: "dollars",
  ccl: "dollars",
  gap: "pressure",
  monthlyInflation: "inflation",
  yearlyInflation: "inflation",
  activity: "pressure",
  activityYearly: "pressure",
  countryRisk: "risk",
  reserves: "money",
  badlar: "rates",
};
