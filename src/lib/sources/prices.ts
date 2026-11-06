/**
 * Reads the SEPA files the daily job publishes (see sepa-format.ts) for the
 * Precios tab.
 *
 * The product index (about 2 MB gzipped) and the branch list are held in
 * memory and checked against `sepa-latest.json` every few minutes: searches
 * never wait on the network once warm. A product's prices are one HTTP range
 * request into the day's prices file (about 1 KB on average), kept in a small
 * in-memory cache. These live in memory rather than in Next's data cache,
 * whose entries are capped at a few megabytes.
 */
import { gunzipSync } from "node:zlib";
import {
  buildPriceView,
  buildSearchIndex,
  searchProducts,
  type PriceView,
  type ProductHit,
} from "@/lib/indicators/prices";
import { fetchJson } from "./http";
import {
  decodeEntries,
  entryRange,
  LATEST_FILE,
  SEPA_VERSION,
  type PriceEntry,
  type SepaBranchesFile,
  type SepaLatest,
  type SepaProduct,
  type SepaProductsFile,
} from "./sepa-format";

/** The release the workflow .github/workflows/sepa.yml publishes to. */
export const SEPA_DATA_URL = "https://github.com/nahuel893/economic-dashboard/releases/download/sepa-data";

/** How often to look for a newer day; SEPA publishes once a day. */
const CHECK_EVERY_MS = 15 * 60_000;
const INDEX_TIMEOUT_MS = 20_000;
const PRICES_TIMEOUT_MS = 10_000;
const PRODUCT_CACHE_SIZE = 500;

const dataUrl = (name: string) => `${(process.env.SEPA_DATA_URL ?? SEPA_DATA_URL).replace(/\/+$/, "")}/${name}`;

type Catalog = {
  latest: SepaLatest;
  branches: SepaBranchesFile;
  products: SepaProduct[];
  byEan: Map<string, SepaProduct>;
  index: string[];
};

async function fetchGzipJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(INDEX_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`GET ${new URL(url).host} responded ${response.status}`);
  return JSON.parse(gunzipSync(new Uint8Array(await response.arrayBuffer())).toString("utf8")) as T;
}

async function loadCatalog(previous: Catalog | null): Promise<Catalog> {
  let latest: SepaLatest;
  try {
    latest = await fetchJson<SepaLatest>(dataUrl(LATEST_FILE));
  } catch (error) {
    // A day already in memory stays useful when GitHub has a bad moment.
    if (previous) return previous;
    throw error;
  }
  if (previous?.latest.date === latest.date) return previous;
  if (latest.version !== SEPA_VERSION) throw new Error(`SEPA files are version ${latest.version}, expected ${SEPA_VERSION}`);

  try {
    const [branches, { products }] = await Promise.all([
      fetchJson<SepaBranchesFile>(dataUrl(latest.files.branches)),
      fetchGzipJson<SepaProductsFile>(dataUrl(latest.files.products)),
    ]);
    return { latest, branches, products, byEan: new Map(products.map((p) => [p[0], p])), index: buildSearchIndex(products) };
  } catch (error) {
    if (previous) return previous;
    throw error;
  }
}

let catalog: { checkedAt: number; value: Promise<Catalog> } | null = null;
let ready: Catalog | null = null;

async function getCatalog(): Promise<Catalog> {
  if (catalog && Date.now() - catalog.checkedAt < CHECK_EVERY_MS) return catalog.value;
  const value = loadCatalog(ready);
  const current = { checkedAt: Date.now(), value };
  catalog = current;
  try {
    ready = await value;
    return ready;
  } catch (error) {
    // Nothing to serve: let the next call try again instead of caching the failure.
    if (catalog === current) catalog = null;
    throw error;
  }
}

const entriesCache = new Map<string, Promise<PriceEntry[]>>();

async function readEntries(day: Catalog, product: SepaProduct): Promise<PriceEntry[]> {
  const [ean, , , offset, count] = product;
  const { start, end } = entryRange(offset, count);
  const url = dataUrl(day.latest.files.prices);
  const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(PRICES_TIMEOUT_MS) });
  if (response.status !== 206) {
    // A 200 would be the whole file (about 85 MB): stop instead of reading it.
    await response.body?.cancel();
    throw new Error(`GET ${new URL(url).host} answered ${response.status} to a range request for ${ean}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== end - start + 1) throw new Error(`Range for ${ean} returned ${bytes.byteLength} bytes, expected ${end - start + 1}`);
  return decodeEntries(bytes);
}

function cachedEntries(day: Catalog, product: SepaProduct): Promise<PriceEntry[]> {
  const key = `${day.latest.date}:${product[0]}`;
  const cached = entriesCache.get(key);
  if (cached) return cached;
  const entries = readEntries(day, product);
  entriesCache.set(key, entries);
  entries.catch(() => entriesCache.delete(key));
  // Oldest out first: Map keeps insertion order.
  if (entriesCache.size > PRODUCT_CACHE_SIZE) entriesCache.delete(entriesCache.keys().next().value!);
  return entries;
}

/** Products matching the query in the latest SEPA day. */
export async function searchSepa(query: string, limit?: number): Promise<{ date: string; hits: ProductHit[] }> {
  const day = await getCatalog();
  return { date: day.latest.date, hits: searchProducts(day.products, day.index, query, limit) };
}

/** The latest SEPA day: its date and counts, for the page header. */
export async function getSepaLatest(): Promise<SepaLatest> {
  return (await getCatalog()).latest;
}

/** One product's prices at every branch, or null when the latest day does not list the barcode. */
export async function getPriceView(ean: string): Promise<PriceView | null> {
  const day = await getCatalog();
  const product = day.byEan.get(ean.trim().replace(/^0+/, ""));
  if (!product) return null;
  return buildPriceView(product, await cachedEntries(day, product), day.branches, day.latest.date);
}
