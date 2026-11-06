/**
 * The Precios tab's pure logic: product search over the SEPA index and the
 * view of one product's prices on the map. Prices arrive in cents and leave in
 * pesos.
 */
import type { PriceEntry, SepaBranchesFile, SepaProduct } from "@/lib/sources/sepa-format";
import { classColor, colorClasses, type ColorClass } from "./maps";

export const SEARCH_LIMIT = 12;
const MIN_QUERY = 2;

/** Lowercase, no accents, words separated by single spaces. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** One searchable string per product, padded with spaces so a word start is " " + word. */
export function buildSearchIndex(products: SepaProduct[]): string[] {
  return products.map(([, name, brand]) => ` ${normalizeText(name)} ${normalizeText(brand)} `);
}

export type ProductHit = { ean: string; name: string; brand: string; stores: number; min: number; max: number };

const hit = ([ean, name, brand, , count, min, max]: SepaProduct): ProductHit => ({
  ean,
  name,
  brand,
  stores: count,
  min: min / 100,
  max: max / 100,
});

/**
 * Products whose name or brand has a word starting with each word of the
 * query, or whose barcode starts with it; in index order, which puts the most
 * widely sold first.
 */
export function searchProducts(products: SepaProduct[], index: string[], query: string, limit = SEARCH_LIMIT): ProductHit[] {
  const normalized = normalizeText(query);
  if (normalized.length < MIN_QUERY) return [];
  const barcode = /^\d{4,14}$/.test(normalized) ? normalized.replace(/^0+/, "") : null;
  const words = normalized.split(" ").map((word) => ` ${word}`);
  const hits: ProductHit[] = [];
  for (let i = 0; i < products.length && hits.length < limit; i++) {
    const matches = (barcode !== null && products[i][0].startsWith(barcode)) || words.every((word) => index[i].includes(word));
    if (matches) hits.push(hit(products[i]));
  }
  return hits;
}

export type PricePoint = {
  /** The branch's index in the day's branch list. */
  id: number;
  chain: string;
  name: string;
  address: string;
  locality: string;
  province: string;
  lon: number;
  lat: number;
  price: number;
  color: string;
};

export type PriceSummary = { min: number; median: number; max: number; stores: number; chains: number };

export type PriceView = {
  ean: string;
  name: string;
  brand: string;
  /** The SEPA day, YYYY-MM-DD. */
  date: string;
  /** Cheapest first. */
  points: PricePoint[];
  summary: PriceSummary;
  classes: ColorClass[];
};

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** One product's prices at every branch that lists it, ready for the map, its legend and the table. */
export function buildPriceView(product: SepaProduct, entries: PriceEntry[], branches: SepaBranchesFile, date: string): PriceView {
  const [ean, name, brand] = product;
  const located = entries
    .filter((entry) => branches.branches[entry.branch] !== undefined)
    .sort((a, b) => a.cents - b.cents || a.branch - b.branch);
  const prices = located.map((entry) => entry.cents / 100);
  const classes = colorClasses(prices);
  const points = located.map(({ branch }, i): PricePoint => {
    const [chain, branchName, address, locality, province, lon, lat] = branches.branches[branch];
    return {
      id: branch,
      chain: branches.chains[chain] ?? "",
      name: branchName,
      address,
      locality,
      province,
      lon,
      lat,
      price: prices[i],
      color: classColor(classes, prices[i]),
    };
  });
  return {
    ean,
    name,
    brand,
    date,
    points,
    summary: {
      min: prices[0] ?? 0,
      median: prices.length ? median(prices) : 0,
      max: prices.at(-1) ?? 0,
      stores: points.length,
      chains: new Set(points.map((p) => p.chain)).size,
    },
    classes,
  };
}
