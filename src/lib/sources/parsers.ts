import type { IndexData, Point, Quote } from "@/lib/indicators/types";

type DolarApiQuote = {
  casa: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
};

/** dolarapi.com /v1/dolares → quotes indexed by exchange house. */
export function parseDolarApi(raw: DolarApiQuote[]): Record<string, Quote> {
  return Object.fromEntries(
    raw.map((q) => [q.casa, { buy: q.compra, sell: q.venta, updatedAt: q.fechaActualizacion }]),
  );
}

type DailyQuote = { compra: number; venta: number; fecha: string };

/** ArgentinaDatos daily quotes → sell-price points. */
export function parseDailyQuotes(raw: DailyQuote[]): Point[] {
  return raw.map((q) => ({ date: q.fecha, value: q.venta }));
}

type BcraSeriesResponse = {
  results: { detalle?: { fecha: string; valor: number }[] }[];
};

/** BCRA Estadísticas v4 monetary series → points in ascending date order. */
export function parseBcraSeries(raw: BcraSeriesResponse): Point[] {
  const detail = raw.results[0]?.detalle;
  if (!detail?.length) throw new Error("BCRA series returned no data");
  return detail
    .map((d) => ({ date: d.fecha, value: d.valor }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

type BymaIndex = {
  date: string;
  symbol: string;
  description: string;
  price: number;
  previousClosingPrice: number;
  variation: number;
  highValue: number;
  minValue: number;
};

/** BYMA open data index-price → one index, with the daily change as a percentage. */
export function parseBymaIndex(raw: { data: BymaIndex[] }, symbol: string): IndexData {
  const index = raw.data.find((i) => i.symbol === symbol);
  if (!index) throw new Error(`BYMA index ${symbol} not found`);
  return {
    date: index.date,
    name: index.description,
    value: index.price,
    previousClose: index.previousClosingPrice,
    changePct: Math.round(index.variation * 100 * 100) / 100,
    high: index.highValue,
    low: index.minValue,
  };
}

/** Table returned by the series API of datos.gob.ar: a date column, then one column per requested id. */
type DatosSeriesResponse = { data: (string | number | null)[][] };

/** One sorted series per requested id, in request order; empty cells are skipped. */
export function parseDatosSeries(raw: DatosSeriesResponse, count: number): Point[][] {
  return Array.from({ length: count }, (_, column) => {
    const points = raw.data.flatMap((row) => {
      const value = row[column + 1];
      return typeof value === "number" ? [{ date: String(row[0]), value }] : [];
    });
    if (!points.length) throw new Error(`datos.gob.ar series ${column + 1} returned no data`);
    return points.sort((a, b) => a.date.localeCompare(b.date));
  });
}
