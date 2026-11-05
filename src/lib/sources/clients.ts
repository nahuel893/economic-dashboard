import { cacheLife } from "next/cache";
import { monthEnd } from "@/lib/indicators/history";
import type { IndexData, Point, Quote } from "@/lib/indicators/types";
import { CITATION_SEPARATOR, SOURCE_NAMES } from "./citations";
import { fetchJson } from "./http";
import { parseBcraSeries, parseBymaIndex, parseDailyQuotes, parseDatosSeries, parseDolarApi } from "./parsers";

/**
 * Cache lifetimes by how fast each kind of data moves. Every client caches its
 * own source, so a slow or failing source never invalidates the others.
 */
export const CACHE = {
  live: { stale: 60, revalidate: 120, expire: 3600 },
  daily: { stale: 300, revalidate: 3600, expire: 86400 },
  /** Large files published monthly or less often (the OEDE wage workbook). */
  slow: { stale: 3600, revalidate: 86400, expire: 7 * 86400 },
} as const;

type CacheProfile = (typeof CACHE)[keyof typeof CACHE];

/** How long a failed request is remembered before the source is tried again. */
const FAILURE_CACHE = { stale: 30, revalidate: 60, expire: 300 } as const;

/** Result of a cached request: cached functions must not reject (see `attempt`). */
export type Outcome<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * Runs a request inside a "use cache" function and turns a failure into a
 * value. A cached function that rejects while a page is prerendered fails the
 * whole build (and hides its message in production), even when the caller
 * catches the error, so failures leave the cache as data and are thrown again
 * by `unwrap`, outside of it. Failures are kept only briefly.
 */
export async function attempt<T>(life: CacheProfile, load: () => Promise<T>): Promise<Outcome<T>> {
  try {
    const value = await load();
    cacheLife(life);
    return { ok: true, value };
  } catch (error) {
    cacheLife(FAILURE_CACHE);
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function unwrap<T>(outcome: Outcome<T>): T {
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value;
}

/** Source cited on each indicator; the full references live in `@/lib/indicators/references`. */
export const SOURCES = {
  dolarApi: SOURCE_NAMES.dolarapi,
  argentinaDatos: SOURCE_NAMES.argentinaDatos,
  bcra: SOURCE_NAMES.bcra,
  byma: SOURCE_NAMES.byma,
  dollars: [SOURCE_NAMES.dolarapi, SOURCE_NAMES.argentinaDatos].join(CITATION_SEPARATOR),
  indec: SOURCE_NAMES.indec,
} as const;

async function cachedLiveDollarQuotes(): Promise<Outcome<Record<string, Quote>>> {
  "use cache";
  return attempt(CACHE.live, async () =>
    parseDolarApi(await fetchJson<Parameters<typeof parseDolarApi>[0]>("https://dolarapi.com/v1/dolares")),
  );
}

export const getLiveDollarQuotes = async () => unwrap(await cachedLiveDollarQuotes());

async function cachedDollarHistory(kind: string): Promise<Outcome<Point[]>> {
  "use cache";
  return attempt(CACHE.daily, async () =>
    parseDailyQuotes(
      await fetchJson<Parameters<typeof parseDailyQuotes>[0]>(`https://api.argentinadatos.com/v1/cotizaciones/dolares/${kind}`),
    ),
  );
}

export const getDollarHistory = async (kind: string) => unwrap(await cachedDollarHistory(kind));

async function cachedCountryRiskHistory(): Promise<Outcome<Point[]>> {
  "use cache";
  return attempt(CACHE.live, async () => {
    const raw = await fetchJson<{ valor: number; fecha: string }[]>(
      "https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais",
    );
    return raw.map((r) => ({ date: r.fecha, value: r.valor }));
  });
}

export const getCountryRiskHistory = async () => unwrap(await cachedCountryRiskHistory());

async function cachedMonthlyIndexHistory(index: string): Promise<Outcome<Point[]>> {
  "use cache";
  return attempt(CACHE.daily, async () => {
    const raw = await fetchJson<{ valor: number; fecha: string }[]>(
      `https://api.argentinadatos.com/v1/finanzas/indices/${index}`,
    );
    return raw.map((r) => ({ date: r.fecha, value: r.valor }));
  });
}

/** Monthly INDEC indexes published by ArgentinaDatos, e.g. "inflacion" or "inflacionInteranual". */
export const getMonthlyIndexHistory = async (index: string) => unwrap(await cachedMonthlyIndexHistory(index));

/** Page size of BCRA Estadísticas v4; longer histories need several requests. */
const BCRA_PAGE = 3000;

async function cachedBcraHistory(id: number, from: string): Promise<Outcome<Point[]>> {
  "use cache";
  return attempt(CACHE.daily, async () => {
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
  });
}

/** A BCRA series from `from` (YYYY-MM-DD) to today, paging through the whole range. */
export const getBcraHistory = async (id: number, from: string) => unwrap(await cachedBcraHistory(id, from));

/** BCRA "Principales Variables" ids used outside the macro groups. */
export const BCRA_VARIABLES = {
  reserves: 1,
  badlar: 7,
  wholesaleDollar: 5,
  bandLower: 1187,
  bandUpper: 1188,
} as const;

async function cachedBcraSeries(id: number, days: number, cache: keyof typeof CACHE): Promise<Outcome<Point[]>> {
  "use cache";
  return attempt(CACHE[cache], async () => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const raw = await fetchJson<Parameters<typeof parseBcraSeries>[0]>(
      `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${id}?desde=${iso(from)}&hasta=${iso(to)}`,
    );
    return parseBcraSeries(raw);
  });
}

export const getBcraSeries = async (id: number, days: number, cache: keyof typeof CACHE) =>
  unwrap(await cachedBcraSeries(id, days, cache));

/** INDEC series on the datos.gob.ar series API. */
export const INDEC_SERIES = {
  /** EMAE (monthly activity, the usual monthly proxy for GDP), base 2004, original series. */
  emae: "143.3_NO_PR_2004_A_21",
  /** EMAE, seasonally adjusted. */
  emaeSeasonallyAdjusted: "143.3_NO_PR_2004_A_31",
} as const;

async function cachedIndecMonthlySeries(ids: string[]): Promise<Outcome<Point[][]>> {
  "use cache";
  return attempt(CACHE.daily, async () => {
    const raw = await fetchJson<Parameters<typeof parseDatosSeries>[0]>(
      `https://apis.datos.gob.ar/series/api/series/?ids=${ids.join(",")}&format=json&limit=5000`,
    );
    return parseDatosSeries(raw, ids.length).map((series) => series.map((p) => ({ ...p, date: monthEnd(p.date) })));
  });
}

/**
 * Full history of monthly INDEC series from datos.gob.ar, one per id and in the
 * same order, dated at the end of each month like the other monthly sources.
 */
export const getIndecMonthlySeries = async (ids: string[]) => unwrap(await cachedIndecMonthlySeries(ids));

async function cachedBymaIndex(symbol: string): Promise<Outcome<IndexData>> {
  "use cache";
  return attempt(CACHE.live, async () => {
    const raw = await fetchJson<Parameters<typeof parseBymaIndex>[0]>(
      "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/index-price",
      { method: "POST", body: {} },
    );
    return parseBymaIndex(raw, symbol);
  });
}

export const getBymaIndex = async (symbol: string) => unwrap(await cachedBymaIndex(symbol));
