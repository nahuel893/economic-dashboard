import { describe, expect, it } from "vitest";
import { formatArs, formatArsMillions, formatAxisValue, formatChange, formatCompact, formatMonth, formatMonthShort, formatNumber, formatSignedPercent, formatUsdMillions, formatValue } from "./format";

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

describe("formatAxisValue", () => {
  it("drops the currency on millions and indexes, and cents on large prices", () => {
    expect(formatAxisValue(50913, "usdMillions")).toBe(formatNumber(50913));
    expect(formatAxisValue(1565.4, "ars2")).toBe(formatArs(1565.4, 0));
    expect(formatAxisValue(3.25, "percent")).toBe(`${formatNumber(3.25, 1)} %`);
  });
});

describe("formatChange", () => {
  it("shows levels in percent and rates in signed percentage points", () => {
    expect(formatChange(21, "percent")).toBe(formatSignedPercent(21, 1));
    expect(formatChange(-5, "points")).toBe(`-${formatNumber(5, 1)} pp`);
    expect(formatChange(0, "points")).toBe(`${formatNumber(0, 1)} pp`);
  });
});

describe("formatCompact", () => {
  it("shortens peso amounts in millions with the Spanish long scale, spelling out billones (10^12)", () => {
    expect(formatCompact(98_221_865, "arsMillions")).toBe("$ 98,2 billones");
    expect(formatCompact(1_234_567, "arsMillions")).toBe("$ 1,23 billones");
    expect(formatCompact(1_000_400, "arsMillions")).toBe("$ 1 billón");
    expect(formatCompact(234_000, "arsMillions")).toBe("$ 234 mil M");
    expect(formatCompact(12_345, "arsMillions")).toBe("$ 12,3 mil M");
    expect(formatCompact(950, "arsMillions")).toBe("$ 950 M");
  });

  it("shortens millions and thousands to three significant digits", () => {
    expect(formatCompact(2_761_629, "ars")).toBe("$ 2,76 M");
    expect(formatCompact(12_345_678, "ars")).toBe("$ 12,3 M");
    expect(formatCompact(1_195_617, "count")).toBe("1,2 M");
    expect(formatCompact(40_566, "count")).toBe("40,6 mil");
    expect(formatCompact(406_000, "count")).toBe("406 mil");
  });

  it("writes millions of USD whole up to the thousands, never as 'mil'", () => {
    expect(normalize(formatCompact(15_965.486, "usdMillions"))).toBe("US$ 15.965 M");
    expect(normalize(formatCompact(1_234, "usdMillions"))).toBe("US$ 1.234 M");
    expect(normalize(formatCompact(292.21, "usdMillions"))).toBe("US$ 292 M");
    expect(normalize(formatCompact(18.26, "usdMillions"))).toBe("US$ 18,3 M");
  });

  it("keeps the decimals of a density and shortens the big ones", () => {
    expect(normalize(formatValue(0.9, "perKm2"))).toBe("0,9 hab./km²");
    expect(normalize(formatValue(15161.3, "perKm2"))).toBe("15.161,3 hab./km²");
    expect(formatCompact(15161.3, "perKm2")).toBe("15,2 mil");
    expect(formatCompact(0.9, "perKm2")).toBe("0,9");
  });

  it("keeps small numbers and percentages whole", () => {
    expect(formatCompact(950, "count")).toBe("950");
    expect(formatCompact(33.42, "percent")).toBe("33,4 %");
    expect(formatCompact(-3.5, "percent")).toBe("-3,5 %");
  });
});
