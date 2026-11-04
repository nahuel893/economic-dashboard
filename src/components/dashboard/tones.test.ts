import { describe, expect, it } from "vitest";
import { PANEL_CHARTS, PANEL_KPIS } from "@/lib/indicators/panel";
import { toneVar, VARIABLE_TONES } from "./tones";

describe("VARIABLE_TONES", () => {
  it("gives a tone to every variable the panel shows", () => {
    for (const key of [...PANEL_KPIS, ...PANEL_CHARTS.flatMap((chart) => chart.series)]) {
      expect(VARIABLE_TONES[key], key).toBeDefined();
    }
  });

  it("keeps the topic tones the history charts already used", () => {
    expect(VARIABLE_TONES).toMatchObject({
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
    });
  });
});

describe("toneVar", () => {
  it("points at the CSS variable of the tone", () => {
    expect(toneVar("rates")).toBe("var(--tone-rates)");
  });
});
