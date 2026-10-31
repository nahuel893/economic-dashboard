import { describe, expect, it } from "vitest";
import { parseBcraSeries, parseBymaIndex, parseDailyQuotes, parseDolarApi } from "./parsers";

describe("parseDolarApi", () => {
  it("indexes live quotes by exchange house", () => {
    const raw = [
      { moneda: "USD", casa: "blue", nombre: "Blue", compra: 1545, venta: 1565, fechaActualizacion: "2026-10-30T20:57:00.000Z" },
      { moneda: "USD", casa: "oficial", nombre: "Oficial", compra: 1510, venta: 1560, fechaActualizacion: "2026-10-30T18:00:00.000Z" },
    ];

    const result = parseDolarApi(raw);

    expect(result.blue).toEqual({ buy: 1545, sell: 1565, updatedAt: "2026-10-30T20:57:00.000Z" });
    expect(result.oficial?.sell).toBe(1560);
  });
});

describe("parseDailyQuotes", () => {
  it("maps daily closes to sell-price points", () => {
    const raw = [{ casa: "blue", compra: 1545, venta: 1565, fecha: "2026-10-30" }];
    expect(parseDailyQuotes(raw)).toEqual([{ date: "2026-10-30", value: 1565 }]);
  });
});

describe("parseBcraSeries", () => {
  it("returns the series points sorted by ascending date", () => {
    const raw = {
      status: 200,
      results: [
        {
          idVariable: 5,
          detalle: [
            { fecha: "2026-10-30", valor: 1537.3487 },
            { fecha: "2026-10-29", valor: 1539.593 },
          ],
        },
      ],
    };

    expect(parseBcraSeries(raw)).toEqual([
      { date: "2026-10-29", value: 1539.593 },
      { date: "2026-10-30", value: 1537.3487 },
    ]);
  });

  it("throws when the response holds no results", () => {
    expect(() => parseBcraSeries({ results: [] })).toThrow();
  });
});

describe("parseBymaIndex", () => {
  const raw = {
    data: [
      { date: "2026-10-30", symbol: "GMSCI", description: "MSCI BYMA General", price: 91999.15, previousClosingPrice: 94232.73, variation: -0.0237, highValue: 94559.73, minValue: 91446.56 },
      { date: "2026-10-30", symbol: "MMSCI", description: "MSCI MERVAL", price: 92079.66, previousClosingPrice: 94529.98, variation: -0.0259, highValue: 94804.45, minValue: 91530.8 },
    ],
  };

  it("extracts the requested index with its daily change in percent", () => {
    expect(parseBymaIndex(raw, "MMSCI")).toEqual({
      date: "2026-10-30",
      name: "MSCI MERVAL",
      value: 92079.66,
      previousClose: 94529.98,
      changePct: -2.59,
      high: 94804.45,
      low: 91530.8,
    });
  });

  it("throws when the index is missing", () => {
    expect(() => parseBymaIndex(raw, "NOPE")).toThrow();
  });
});
