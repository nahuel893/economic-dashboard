import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AGLOMERADOS } from "@/lib/indicators/geography";

const { cacheLife, fetchJson } = vi.hoisted(() => ({ cacheLife: vi.fn(), fetchJson: vi.fn() }));
vi.mock("next/cache", () => ({ cacheLife }));
vi.mock("./http", () => ({ fetchJson }));

import { CACHE } from "./clients";
import { getEphPovertyMap, getRegionalInflationMap, getUnemploymentMap, getWageMap, IPC_REGION_SERIES, WAGES_URL } from "./maps";

const workbook = readFileSync(new URL("./__fixtures__/oede-wages.xlsx", import.meta.url));
const INDEX_URL = "https://www.argentina.gob.ar/node/142211";
const CURRENT = "https://www.argentina.gob.ar/sites/default/files/provinciales_serie_remuneraciones_mensual_2dig_10.xlsx";

function mockFetch(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn(async (url: string) => {
    const route = routes[url];
    if (!route) throw new Error(`unexpected fetch ${url}`);
    return route();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("map loaders", () => {
  beforeEach(() => {
    cacheLife.mockReset();
    fetchJson.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads the wage workbook linked from the OEDE index page and caches it", async () => {
    const fetchMock = mockFetch({
      [INDEX_URL]: () => new Response(`<a href="/sites/default/files/provinciales_serie_remuneraciones_mensual_2dig_10.xlsx">`),
      [CURRENT]: () => new Response(workbook),
    });
    const series = await getWageMap();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([INDEX_URL, CURRENT]);
    expect(series.periods.map((p) => [p.period, p.note])).toEqual([
      ["2025-11", undefined],
      ["2025-12", "Incluye aguinaldo"],
      ["2026-01", undefined],
    ]);
    expect(series.periods[2].values["06-gba"]).toEqual({ value: 1002 });
    expect(series.periods[0].values["94"]).toEqual({ value: 25000 });
    expect(cacheLife).toHaveBeenCalledWith(CACHE.slow);
  });

  it("falls back to the pinned workbook when the index page fails", async () => {
    const fetchMock = mockFetch({
      [INDEX_URL]: () => new Response("busy", { status: 503 }),
      [WAGES_URL]: () => new Response(workbook),
    });
    await expect(getWageMap()).resolves.toMatchObject({ periods: expect.any(Array) });
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(WAGES_URL);
  });

  it("rejects with the source's error when the workbook cannot be fetched, and keeps the failure briefly", async () => {
    mockFetch({
      [INDEX_URL]: () => new Response(""),
      [WAGES_URL]: () => new Response("gone", { status: 404 }),
    });
    await expect(getWageMap()).rejects.toThrow("GET www.argentina.gob.ar responded 404");
    expect(cacheLife).toHaveBeenCalledWith(expect.objectContaining({ revalidate: 60 }));
  });

  it("computes regional inflation from the six IPC level series", async () => {
    fetchJson.mockResolvedValue({
      data: [
        ["2025-01-01", 100, 100, 100, 100, 100, 100],
        ["2025-12-01", 120, 120, 120, 120, 120, 120],
        ["2026-01-01", 125, 126, 127, 128, 129, 130],
      ],
    });
    const { monthly, yearOnYear } = await getRegionalInflationMap();
    expect(fetchJson.mock.calls[0][0]).toContain(`ids=${Object.values(IPC_REGION_SERIES).join(",")}`);
    expect(monthly.periods.map((p) => p.period)).toEqual(["2026-01"]);
    expect(monthly.periods[0].values.Patagonia.value).toBeCloseTo(8.3333, 4);
    expect(yearOnYear.periods[0].values.NEA.value).toBeCloseTo(28, 6);
    expect(cacheLife).toHaveBeenCalledWith(CACHE.daily);
  });

  it("serves the committed EPH snapshots keyed by known aglomerados, in ascending order", async () => {
    const known = new Set(AGLOMERADOS.map((a) => a.code));
    const poverty = await getEphPovertyMap();
    const unemployment = await getUnemploymentMap();
    for (const series of [...Object.values(poverty), unemployment]) {
      const periods = series.periods.map((p) => p.period);
      expect(periods.length).toBeGreaterThan(0);
      expect(periods).toEqual([...periods].sort());
      for (const { values } of series.periods) {
        for (const code of Object.keys(values)) expect(known).toContain(code);
      }
    }
    expect(poverty.povertyPersons.periods.at(-1)?.values["32"]).toMatchObject({ value: expect.any(Number), cv: expect.any(Number) });
  });
});
