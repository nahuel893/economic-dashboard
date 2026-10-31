import { describe, expect, it } from "vitest";
import {
  formatArs,
  formatArsMillions,
  formatMonth,
  formatMonthShort,
  formatNumber,
  formatSignedPercent,
  formatUsdMillions,
  formatValue,
} from "./format";

// Intl may use a narrow no-break space between "$" and the amount.
const normalize = (s: string) => s.replace(/\s/g, " ");

describe("formatArs", () => {
  it("uses es-AR separators and no decimals for large amounts", () => {
    expect(normalize(formatArs(1565))).toBe("$ 1.565");
  });

  it("keeps two decimals when requested", () => {
    expect(normalize(formatArs(1653.91, 2))).toBe("$ 1.653,91");
  });
});

describe("formatNumber", () => {
  it("groups thousands with a dot", () => {
    expect(formatNumber(50603)).toBe("50.603");
  });
});

describe("formatUsdMillions", () => {
  it("keeps the amount in millions of dollars", () => {
    expect(formatUsdMillions(50603)).toBe("US$ 50.603 M");
  });
});

describe("formatArsMillions", () => {
  it("expresses trillions of pesos as billones", () => {
    expect(normalize(formatArsMillions(45680819))).toBe("$ 45,7 billones");
  });

  it("expresses smaller amounts as mil millones", () => {
    expect(normalize(formatArsMillions(900000))).toBe("$ 900,0 mil millones");
  });
});

describe("formatValue", () => {
  it("formats by unit", () => {
    expect(normalize(formatValue(1565, "ars"))).toBe("$ 1.565");
    expect(normalize(formatValue(22.39, "percent"))).toBe("22,4 %");
    expect(formatValue(741, "bps")).toBe("741 pb");
    expect(formatValue(862.27597, "index")).toBe("862,2760");
  });
});

describe("formatMonth", () => {
  it("names the month of a monthly data point without shifting it", () => {
    expect(formatMonth("2026-09-30")).toBe("septiembre de 2026");
    expect(formatMonth("2026-10-01")).toBe("octubre de 2026");
  });
});

describe("formatMonthShort", () => {
  it("abbreviates the month without a trailing period", () => {
    expect(formatMonthShort("2026-10-31")).toBe("oct");
    expect(formatMonthShort("2026-01-31")).toBe("ene");
  });
});

describe("formatSignedPercent", () => {
  it("prefixes positive values with a plus sign", () => {
    expect(normalize(formatSignedPercent(2.5))).toBe("+2,5 %");
  });

  it("keeps the minus sign for negative values", () => {
    expect(normalize(formatSignedPercent(-2.59))).toBe("-2,6 %");
  });
});
