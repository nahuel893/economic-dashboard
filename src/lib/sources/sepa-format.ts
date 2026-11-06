/**
 * The files the daily SEPA job publishes and the app reads: the contract
 * between `scripts/prices/build-sepa.mts` and `src/lib/sources/prices.ts`.
 * Pure and dependency free, so the build script can import it directly.
 *
 * - `sepa-latest.json` names the day and its three files. It is uploaded
 *   last, so it never points at files that are not there yet.
 * - `sepa-branches-<date>.json`: every branch with prices, with its chain and
 *   location.
 * - `sepa-products-<date>.json.gz`: one row per product (EAN), most widely
 *   sold first, with where its prices start in the prices file.
 * - `sepa-prices-<date>.bin`: every product's prices, back to back, cheapest
 *   first. The app reads one product's bytes with an HTTP range request.
 *
 * Files are named by date so a reader holding one day's product index never
 * reads another day's prices.
 */

export const SEPA_VERSION = 1;

export const LATEST_FILE = "sepa-latest.json";

/** One price entry: uint16 branch index, then uint32 price in cents, little endian. */
export const ENTRY_BYTES = 6;

/** The largest branch index and price an entry can hold. */
export const MAX_BRANCHES = 0xffff;
export const MAX_CENTS = 0xffffffff;

export type SepaFiles = { branches: string; products: string; prices: string };

export const sepaFiles = (date: string): SepaFiles => ({
  branches: `sepa-branches-${date}.json`,
  products: `sepa-products-${date}.json.gz`,
  prices: `sepa-prices-${date}.bin`,
});

export type SepaLatest = {
  version: typeof SEPA_VERSION;
  /** The day SEPA published, YYYY-MM-DD. */
  date: string;
  builtAt: string;
  files: SepaFiles;
  counts: { chains: number; branches: number; products: number; prices: number };
  /** Chain archives that could not be read that day. */
  skipped: string[];
};

/** Chain index, branch name, street address, locality, province, longitude, latitude. */
export type SepaBranch = [chain: number, name: string, address: string, locality: string, province: string, lon: number, lat: number];

export type SepaBranchesFile = { chains: string[]; branches: SepaBranch[] };

/** EAN, name, brand, first entry in the prices file, entry count, lowest and highest price in cents. */
export type SepaProduct = [ean: string, name: string, brand: string, offset: number, count: number, min: number, max: number];

export type SepaProductsFile = { products: SepaProduct[] };

export type PriceEntry = { branch: number; cents: number };

/** Writes entries into `target` from byte `at`; returns the byte after the last one. */
export function writeEntries(entries: PriceEntry[], target: Uint8Array, at = 0): number {
  const view = new DataView(target.buffer, target.byteOffset, target.byteLength);
  let offset = at;
  for (const { branch, cents } of entries) {
    view.setUint16(offset, branch, true);
    view.setUint32(offset + 2, cents, true);
    offset += ENTRY_BYTES;
  }
  return offset;
}

export function encodeEntries(entries: PriceEntry[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(entries.length * ENTRY_BYTES);
  writeEntries(entries, bytes);
  return bytes;
}

export function decodeEntries(bytes: Uint8Array): PriceEntry[] {
  if (bytes.byteLength % ENTRY_BYTES !== 0) throw new Error(`Price bytes are not whole entries (${bytes.byteLength} bytes)`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: bytes.byteLength / ENTRY_BYTES }, (_, i) => ({
    branch: view.getUint16(i * ENTRY_BYTES, true),
    cents: view.getUint32(i * ENTRY_BYTES + 2, true),
  }));
}

/** The byte range of a product's entries, for an HTTP `Range` header (inclusive end). */
export function entryRange(offset: number, count: number): { start: number; end: number } {
  return { start: offset * ENTRY_BYTES, end: (offset + count) * ENTRY_BYTES - 1 };
}

/** SEPA reports provinces as ISO 3166-2 codes. */
export const PROVINCE_NAMES: Record<string, string> = {
  "AR-C": "Ciudad de Buenos Aires",
  "AR-B": "Buenos Aires",
  "AR-K": "Catamarca",
  "AR-H": "Chaco",
  "AR-U": "Chubut",
  "AR-X": "Córdoba",
  "AR-W": "Corrientes",
  "AR-E": "Entre Ríos",
  "AR-P": "Formosa",
  "AR-Y": "Jujuy",
  "AR-L": "La Pampa",
  "AR-F": "La Rioja",
  "AR-M": "Mendoza",
  "AR-N": "Misiones",
  "AR-Q": "Neuquén",
  "AR-R": "Río Negro",
  "AR-A": "Salta",
  "AR-J": "San Juan",
  "AR-D": "San Luis",
  "AR-Z": "Santa Cruz",
  "AR-S": "Santa Fe",
  "AR-G": "Santiago del Estero",
  "AR-V": "Tierra del Fuego",
  "AR-T": "Tucumán",
};
