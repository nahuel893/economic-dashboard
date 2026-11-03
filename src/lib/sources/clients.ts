import { cacheLife } from "next/cache";
import type { IndexData, Point, Quote } from "@/lib/indicators/types";
import { fetchJson } from "./http";
import { parseBcraSeries, parseBymaIndex, parseDailyQuotes, parseDolarApi } from "./parsers";

/**
 * Cache lifetimes by how fast each kind of data moves. Every client caches its
 * own source, so a slow or failing source never invalidates the others.
 */
export const CACHE = {
  live: { stale: 60, revalidate: 120, expire: 3600 },
  daily: { stale: 300, revalidate: 3600, expire: 86400 },
} as const;

export const SOURCES = {
  dolarApi: "dolarapi.com",
  argentinaDatos: "ArgentinaDatos",
  bcra: "BCRA",
  byma: "BYMA",
  dollars: "dolarapi.com · ArgentinaDatos",
} as const;

export async function getLiveDollarQuotes(): Promise<Record<string, Quote>> {
  "use cache";
  cacheLife(CACHE.live);
  const raw = await fetchJson<Parameters<typeof parseDolarApi>[0]>("https://dolarapi.com/v1/dolares");
  return parseDolarApi(raw);
}

export async function getDollarHistory(kind: string): Promise<Point[]> {
  "use cache";
  cacheLife(CACHE.daily);
  const raw = await fetchJson<Parameters<typeof parseDailyQuotes>[0]>(
    `https://api.argentinadatos.com/v1/cotizaciones/dolares/${kind}`,
  );
  return parseDailyQuotes(raw);
}

export async function getCountryRiskHistory(): Promise<Point[]> {
  "use cache";
  cacheLife(CACHE.live);
  const raw = await fetchJson<{ valor: number; fecha: string }[]>(
    "https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais",
  );
  return raw.map((r) => ({ date: r.fecha, value: r.valor }));
}

/** Monthly INDEC indexes published by ArgentinaDatos, e.g. "inflacion" or "inflacionInteranual". */
export async function getMonthlyIndexHistory(index: string): Promise<Point[]> {
  "use cache";
  cacheLife(CACHE.daily);
  const raw = await fetchJson<{ valor: number; fecha: string }[]>(
    `https://api.argentinadatos.com/v1/finanzas/indices/${index}`,
  );
  return raw.map((r) => ({ date: r.fecha, value: r.valor }));
}

/** Page size of BCRA Estadísticas v4; longer histories need several requests. */
const BCRA_PAGE = 3000;

/** A BCRA series from `from` (YYYY-MM-DD) to today, paging through the whole range. */
export async function getBcraHistory(id: number, from: string): Promise<Point[]> {
  "use cache";
  cacheLife(CACHE.daily);
  const to = new Date().toISOString().slice(0, 10);
  const points: Point[] = [];
  for (let offset = 0; ; offset += BCRA_PAGE) {
    const raw = await fetchJson<Parameters<typeof parseBcraSeries>[0] & { metadata: { resultset: { count: number } } }>(
      `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${id}?desde=${from}&hasta=${to}&limit=${BCRA_PAGE}&offset=${offset}`,
    );
    points.push(...parseBcraSeries(raw));
    if (offset + BCRA_PAGE >= raw.metadata.resultset.count) break;
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** BCRA "Principales Variables" ids used by the dashboard. */
export const BCRA_VARIABLES = {
  wholesaleDollar: 5,
  bandLower: 1187,
  bandUpper: 1188,
} as const;

export async function getBcraSeries(id: number, days: number, cache: keyof typeof CACHE): Promise<Point[]> {
  "use cache";
  cacheLife(CACHE[cache]);
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const raw = await fetchJson<Parameters<typeof parseBcraSeries>[0]>(
    `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${id}?desde=${iso(from)}&hasta=${iso(to)}`,
  );
  return parseBcraSeries(raw);
}

export async function getBymaIndex(symbol: string): Promise<IndexData> {
  "use cache";
  cacheLife(CACHE.live);
  const raw = await fetchJson<Parameters<typeof parseBymaIndex>[0]>(
    "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/index-price",
    { method: "POST", body: {} },
  );
  return parseBymaIndex(raw, symbol);
}
