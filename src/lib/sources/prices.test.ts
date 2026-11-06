import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeEntries, LATEST_FILE, sepaFiles, type SepaBranchesFile, type SepaLatest, type SepaProduct } from "./sepa-format";

const BASE = "https://data.test/sepa";

const BRANCHES: SepaBranchesFile = {
  chains: ["Coto", "Disco"],
  branches: [
    [0, "Coto Palermo", "Av. Bullrich 345", "CABA", "Ciudad de Buenos Aires", -58.42, -34.57],
    [1, "Disco Nueva Córdoba", "Obispo Trejo 1200", "Córdoba", "Córdoba", -64.18, -31.42],
  ],
};
const PRODUCTS: SepaProduct[] = [
  ["7791337007253", "Leche chocolatada Cindor x 1L", "CINDOR", 0, 2, 359200, 400000],
  ["7790070411709", "Café molido Cabrales 500 g", "CABRALES", 2, 1, 990000, 990000],
];
const PRICES = encodeEntries([
  { branch: 0, cents: 359200 },
  { branch: 1, cents: 400000 },
  { branch: 0, cents: 990000 },
]);

const latest = (date: string): SepaLatest => ({
  version: 1,
  date,
  builtAt: `${date}T21:00:00Z`,
  files: sepaFiles(date),
  counts: { chains: 2, branches: 2, products: 2, prices: 3 },
  skipped: [],
});

/** Serves one day's files, honoring byte ranges on the prices file like GitHub does. */
function serve(date: string, options: { ignoreRange?: boolean } = {}) {
  const files = sepaFiles(date);
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const name = url.slice(BASE.length + 1);
    if (name === LATEST_FILE) return Response.json(latest(date));
    if (name === files.branches) return Response.json(BRANCHES);
    if (name === files.products) return new Response(gzipSync(JSON.stringify({ products: PRODUCTS })));
    if (name === files.prices) {
      const range = /bytes=(\d+)-(\d+)/.exec(new Headers(init?.headers).get("Range") ?? "");
      if (!range || options.ignoreRange) return new Response(PRICES);
      return new Response(PRICES.slice(Number(range[1]), Number(range[2]) + 1), { status: 206 });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function load() {
  vi.resetModules();
  vi.stubEnv("SEPA_DATA_URL", `${BASE}/`);
  return import("./prices");
}

beforeEach(() => vi.useFakeTimers({ now: new Date("2026-11-05T22:00:00Z"), toFake: ["Date"] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("searchSepa", () => {
  it("searches the day's index and says which day it is", async () => {
    serve("2026-11-05");
    const { searchSepa } = await load();
    expect(await searchSepa("cafe")).toEqual({
      date: "2026-11-05",
      hits: [{ ean: "7790070411709", name: "Café molido Cabrales 500 g", brand: "CABRALES", stores: 1, min: 9900, max: 9900 }],
    });
  });

  it("downloads the index once while the day stays the same", async () => {
    const fetchMock = serve("2026-11-05");
    const { searchSepa } = await load();
    await searchSepa("leche");
    vi.setSystemTime(new Date("2026-11-05T23:00:00Z"));
    await searchSepa("cafe");
    const names = fetchMock.mock.calls.map(([url]) => String(url).slice(BASE.length + 1));
    expect(names.filter((n) => n === sepaFiles("2026-11-05").products)).toHaveLength(1);
    expect(names.filter((n) => n === LATEST_FILE)).toHaveLength(2);
  });

  it("switches to a new day once it is published", async () => {
    serve("2026-11-05");
    const { searchSepa } = await load();
    await searchSepa("leche");
    serve("2026-11-06");
    vi.setSystemTime(new Date("2026-11-06T22:00:00Z"));
    expect((await searchSepa("leche")).date).toBe("2026-11-06");
  });

  it("keeps serving the day it has when the new index cannot be read", async () => {
    serve("2026-11-05");
    const { searchSepa } = await load();
    await searchSepa("leche");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 502 })));
    vi.setSystemTime(new Date("2026-11-06T22:00:00Z"));
    expect((await searchSepa("leche")).date).toBe("2026-11-05");
  });

  it("fails when there is no index yet, and tries again on the next call", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 502 })));
    const { searchSepa } = await load();
    await expect(searchSepa("leche")).rejects.toThrow(/502/);
    serve("2026-11-05");
    expect((await searchSepa("leche")).hits).toHaveLength(1);
  });
});

describe("getPriceView", () => {
  it("reads only the product's bytes from the prices file and places each branch", async () => {
    const fetchMock = serve("2026-11-05");
    const { getPriceView } = await load();
    const view = await getPriceView("7790070411709");
    expect(view?.points.map((p) => [p.name, p.price])).toEqual([["Coto Palermo", 9900]]);
    const priceCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith(".bin"));
    expect(new Headers(priceCall?.[1]?.headers).get("Range")).toBe("bytes=12-17");
  });

  it("is null for a barcode the day does not have", async () => {
    serve("2026-11-05");
    const { getPriceView } = await load();
    expect(await getPriceView("123")).toBeNull();
  });

  it("refuses a server that ignores the range instead of downloading the whole file", async () => {
    serve("2026-11-05", { ignoreRange: true });
    const { getPriceView } = await load();
    await expect(getPriceView("7791337007253")).rejects.toThrow(/range/);
  });
});
