/**
 * Turns one day of SEPA files into the compact files the Precios tab reads
 * (see src/lib/sources/sepa-format.ts). Pure: the CLI in build-sepa.mts does
 * the downloading, unzipping and file writing.
 *
 * SEPA quirks handled here:
 * - Every CSV is pipe separated, starts with a BOM and ends with an
 *   "Ultima actualizacion: ..." footer line.
 * - Some branch records are split over several lines with no quoting, so lines
 *   are joined until the record has as many fields as the header.
 * - `productos_ean` is 0 for chain-internal codes (bulk produce, deli). Those
 *   codes mean different things at each chain, so they are left out.
 */
import {
  ENTRY_BYTES,
  MAX_BRANCHES,
  MAX_CENTS,
  PROVINCE_NAMES,
  type SepaBranch,
  type SepaBranchesFile,
  type SepaProduct,
} from "../../src/lib/sources/sepa-format";

const SEPARATOR = "|";
const FOOTER = /^\s*ultima actualizaci[oó]n/i;

/** Argentina's mainland and Tierra del Fuego; a branch outside has a broken location. */
const BOUNDS = { south: -56, north: -21, west: -74, east: -53 };

const clean = (text: string | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

const isSkippable = (line: string) => line.trim() === "" || FOOTER.test(line);

/** A SEPA CSV as its header and records, joining records split over several lines. */
export function readRecords(text: string): { header: string[]; rows: string[][] } {
  const [first = "", ...lines] = text.replace(/^﻿/, "").split(/\r?\n/);
  const header = first.split(SEPARATOR).map((name) => name.trim());
  const rows: string[][] = [];
  let pending: string | null = null;
  for (const line of lines) {
    if (pending === null && isSkippable(line)) continue;
    pending = pending === null ? line : pending + line;
    const fields = pending.split(SEPARATOR);
    if (fields.length < header.length) continue;
    // A record with too many fields cannot be told apart from its neighbors: it is dropped.
    if (fields.length === header.length) rows.push(fields);
    pending = null;
  }
  return { header, rows };
}

function columns<const K extends string>(header: string[], names: readonly K[]): Record<K, number> {
  return Object.fromEntries(
    names.map((name) => {
      const index = header.indexOf(name);
      if (index === -1) throw new Error(`SEPA file has no "${name}" column`);
      return [name, index];
    }),
  ) as Record<K, number>;
}

const PRICE_COLUMNS = [
  "id_comercio",
  "id_bandera",
  "id_sucursal",
  "id_producto",
  "productos_ean",
  "productos_descripcion",
  "productos_marca",
  "productos_precio_lista",
] as const;

/** A typed array that grows as values are pushed. */
class Growable<T extends Uint16Array | Uint32Array> {
  length = 0;
  private readonly make: (size: number) => T;
  private data: T;

  // Plain fields, not parameter properties: Node runs this file by stripping types only.
  constructor(make: (size: number) => T) {
    this.make = make;
    this.data = make(1 << 16);
  }

  push(value: number) {
    if (this.length === this.data.length) {
      const bigger = this.make(this.data.length * 2);
      bigger.set(this.data);
      this.data = bigger;
    }
    this.data[this.length++] = value;
  }

  get(index: number): number {
    return this.data[index];
  }
}

export type SepaStats = {
  /** Prices kept, one per product and branch. */
  prices: number;
  /** A branch listing the same EAN again; its lowest price is kept. */
  duplicates: number;
  internalCodes: number;
  /** Prices of branches missing from the branch list or without a usable location. */
  unknownBranches: number;
  badPrices: number;
  malformed: number;
  footer: number;
};

export type SepaBuild = { branches: SepaBranchesFile; products: SepaProduct[]; prices: Uint8Array; stats: SepaStats };

/** Collects chains, branches and prices one chain at a time, then builds the published files. */
export class SepaCollector {
  private readonly chains: string[] = [];
  private readonly chainIds = new Map<string, number>();
  private readonly chainByName = new Map<string, number>();
  private readonly branches: SepaBranch[] = [];
  private readonly branchIds = new Map<string, number>();
  private readonly eans: string[] = [];
  /** Per product, each name+brand seen and how many chain files used it. */
  private readonly names: Map<string, { sources: number; lastSource: number }>[] = [];
  private source = -1;
  private readonly productIds = new Map<string, number>();
  private readonly entryProduct = new Growable((size) => new Uint32Array(size));
  private readonly entryBranch = new Growable((size) => new Uint16Array(size));
  private readonly entryCents = new Growable((size) => new Uint32Array(size));
  private priceColumns: Record<(typeof PRICE_COLUMNS)[number], number> | null = null;
  private priceWidth = 0;
  private readonly stats: SepaStats = { prices: 0, duplicates: 0, internalCodes: 0, unknownBranches: 0, badPrices: 0, malformed: 0, footer: 0 };

  /** Registers a chain's banners (comercio.csv) and its branches with a usable location (sucursales.csv). */
  addChain(comercioCsv: string, sucursalesCsv: string): void {
    const comercio = readRecords(comercioCsv);
    const cc = columns(comercio.header, ["id_comercio", "id_bandera", "comercio_bandera_nombre"]);
    for (const row of comercio.rows) {
      const key = `${row[cc.id_comercio].trim()}|${row[cc.id_bandera].trim()}`;
      if (this.chainIds.has(key)) continue;
      // Banners of one company may share a name (SuperChangomas): they are one chain on the map.
      const name = clean(row[cc.comercio_bandera_nombre]);
      let chain = this.chainByName.get(name);
      if (chain === undefined) {
        chain = this.chains.length;
        this.chainByName.set(name, chain);
        this.chains.push(name);
      }
      this.chainIds.set(key, chain);
    }

    const sucursales = readRecords(sucursalesCsv);
    const sc = columns(sucursales.header, [
      "id_comercio",
      "id_bandera",
      "id_sucursal",
      "sucursales_nombre",
      "sucursales_calle",
      "sucursales_numero",
      "sucursales_latitud",
      "sucursales_longitud",
      "sucursales_localidad",
      "sucursales_provincia",
    ]);
    for (const row of sucursales.rows) {
      const chainKey = `${row[sc.id_comercio].trim()}|${row[sc.id_bandera].trim()}`;
      const chain = this.chainIds.get(chainKey);
      const lat = Number(row[sc.sucursales_latitud]);
      const lon = Number(row[sc.sucursales_longitud]);
      const located = lat > BOUNDS.south && lat < BOUNDS.north && lon > BOUNDS.west && lon < BOUNDS.east;
      if (chain === undefined || !located) continue;
      if (this.branches.length > MAX_BRANCHES) throw new Error(`More than ${MAX_BRANCHES + 1} branches`);
      const province = clean(row[sc.sucursales_provincia]);
      this.branchIds.set(`${chainKey}|${row[sc.id_sucursal].trim()}`, this.branches.length);
      this.branches.push([
        chain,
        clean(row[sc.sucursales_nombre]),
        clean(`${row[sc.sucursales_calle]} ${row[sc.sucursales_numero]}`),
        clean(row[sc.sucursales_localidad]),
        PROVINCE_NAMES[province] ?? province,
        lon,
        lat,
      ]);
    }
  }

  /** Reads the header of a chain's productos.csv; its lines follow through `addPriceLine`. */
  startPrices(headerLine: string): void {
    const header = headerLine.replace(/^﻿/, "").split(SEPARATOR).map((name) => name.trim());
    this.priceColumns = columns(header, PRICE_COLUMNS);
    this.priceWidth = header.length;
    this.source++;
  }

  addPriceLine(line: string): void {
    const c = this.priceColumns;
    if (!c) throw new Error("addPriceLine before startPrices");
    if (isSkippable(line)) {
      this.stats.footer++;
      return;
    }
    const fields = line.split(SEPARATOR);
    if (fields.length !== this.priceWidth) {
      this.stats.malformed++;
      return;
    }
    const ean = fields[c.id_producto].trim().replace(/^0+/, "");
    if (fields[c.productos_ean].trim() !== "1" || !/^\d{6,14}$/.test(ean)) {
      this.stats.internalCodes++;
      return;
    }
    const branch = this.branchIds.get(`${fields[c.id_comercio].trim()}|${fields[c.id_bandera].trim()}|${fields[c.id_sucursal].trim()}`);
    if (branch === undefined) {
      this.stats.unknownBranches++;
      return;
    }
    const text = fields[c.productos_precio_lista].trim();
    const cents = text === "" ? NaN : Math.round(Number(text) * 100);
    if (!Number.isFinite(cents) || cents <= 0 || cents > MAX_CENTS) {
      this.stats.badPrices++;
      return;
    }

    let product = this.productIds.get(ean);
    if (product === undefined) {
      product = this.eans.length;
      this.productIds.set(ean, product);
      this.eans.push(ean);
      this.names.push(new Map());
    }
    const nameKey = `${clean(fields[c.productos_descripcion])}\u0000${clean(fields[c.productos_marca])}`;
    const seen = this.names[product].get(nameKey);
    if (!seen) this.names[product].set(nameKey, { sources: 1, lastSource: this.source });
    else if (seen.lastSource !== this.source) {
      seen.sources++;
      seen.lastSource = this.source;
    }

    this.entryProduct.push(product);
    this.entryBranch.push(branch);
    this.entryCents.push(cents);
  }

  build(): SepaBuild {
    const total = this.entryProduct.length;
    const productCount = this.eans.length;

    // Group the entries by product (counting sort), keeping their arrival order.
    const starts = new Uint32Array(productCount + 1);
    for (let i = 0; i < total; i++) starts[this.entryProduct.get(i) + 1]++;
    for (let p = 0; p < productCount; p++) starts[p + 1] += starts[p];
    const order = new Uint32Array(total);
    const next = starts.slice(0, productCount);
    for (let i = 0; i < total; i++) order[next[this.entryProduct.get(i)]++] = i;

    // Within each product: cheapest first, one price per branch (its lowest).
    const keptBranch = new Uint16Array(total);
    const keptCents = new Uint32Array(total);
    const keptStart = new Uint32Array(productCount);
    const keptCount = new Uint32Array(productCount);
    const seenBy = new Int32Array(this.branches.length).fill(-1);
    let kept = 0;
    for (let p = 0; p < productCount; p++) {
      const group = Array.from(order.subarray(starts[p], starts[p + 1]));
      group.sort((a, b) => this.entryCents.get(a) - this.entryCents.get(b) || this.entryBranch.get(a) - this.entryBranch.get(b));
      keptStart[p] = kept;
      for (const i of group) {
        const branch = this.entryBranch.get(i);
        if (seenBy[branch] === p) {
          this.stats.duplicates++;
          continue;
        }
        seenBy[branch] = p;
        keptBranch[kept] = branch;
        keptCents[kept] = this.entryCents.get(i);
        kept++;
      }
      keptCount[p] = kept - keptStart[p];
    }

    // Most widely sold first, so search results lead with the common products.
    const ranked = Array.from({ length: productCount }, (_, p) => p)
      .filter((p) => keptCount[p] > 0)
      .sort((a, b) => keptCount[b] - keptCount[a] || (this.eans[a] < this.eans[b] ? -1 : 1));

    const prices = new Uint8Array(kept * ENTRY_BYTES);
    const view = new DataView(prices.buffer);
    const products: SepaProduct[] = [];
    let offset = 0;
    for (const p of ranked) {
      const start = keptStart[p];
      const count = keptCount[p];
      for (let k = 0; k < count; k++) {
        view.setUint16((offset + k) * ENTRY_BYTES, keptBranch[start + k], true);
        view.setUint32((offset + k) * ENTRY_BYTES + 2, keptCents[start + k], true);
      }
      const [name, brand] = bestName(this.names[p]).split("\u0000");
      products.push([this.eans[p], name, brand, offset, count, keptCents[start], keptCents[start + count - 1]]);
      offset += count;
    }

    this.stats.prices = kept;
    return { branches: { chains: this.chains, branches: this.branches }, products, prices, stats: { ...this.stats } };
  }
}

/**
 * The name most chains use, so one chain with many branches and terse names
 * (DIA's "CHOCOLATADA") does not name the product for everyone; on a tie, the
 * fullest name.
 */
function bestName(names: Map<string, { sources: number }>): string {
  let best = "";
  let bestSources = 0;
  for (const [key, { sources }] of names) {
    if (sources > bestSources || (sources === bestSources && key.length > best.length)) {
      best = key;
      bestSources = sources;
    }
  }
  return best;
}
