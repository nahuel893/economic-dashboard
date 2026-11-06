/**
 * Builds one day of SEPA prices into the files the Precios tab reads
 * (see src/lib/sources/sepa-format.ts) and writes them to --out.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/prices/build-sepa.mts --out DIR [--zip FILE]
 *
 * Without --zip it downloads the newest daily archive listed by the dataset
 * (about 325 MB). Needs Node 23.6+ (runs TypeScript directly) and the `unzip`
 * command. A chain archive that cannot be read is skipped and listed in
 * sepa-latest.json; the build fails if the day is too small to be complete.
 * The GitHub Actions workflow .github/workflows/sepa.yml runs this daily.
 */
import { execFileSync } from "node:child_process";
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { gzipSync } from "node:zlib";

// Resolve extensionless imports, so the shared modules run as they do in the app.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (/^(\.|file:)/.test(specifier)) return next(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { LATEST_FILE, SEPA_VERSION, sepaFiles } = await import("../../src/lib/sources/sepa-format");
const { SepaCollector } = await import("./sepa-build");
type SepaLatest = import("../../src/lib/sources/sepa-format").SepaLatest;

const DATASET_API = "https://datos.produccion.gob.ar/api/3/action/package_show?id=sepa-precios";

/** Smaller than this, a day is missing most of its chains: better keep the previous one. */
const MIN_PRODUCTS = 20_000;
const MIN_BRANCHES = 1_000;

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

type Resource = { name: string; format: string; url: string; last_modified?: string; created?: string };

async function downloadLatest(dir: string): Promise<string> {
  const response = await fetch(DATASET_API, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`SEPA dataset responded ${response.status}`);
  const { result } = (await response.json()) as { result: { resources: Resource[] } };
  const newest = result.resources
    .filter((r) => r.format.toUpperCase() === "ZIP")
    .sort((a, b) => (b.last_modified ?? b.created ?? "").localeCompare(a.last_modified ?? a.created ?? ""))[0];
  if (!newest) throw new Error("SEPA dataset lists no ZIP");
  console.log(`Downloading ${newest.name} (${newest.last_modified}) ${newest.url}`);
  const file = join(dir, basename(new URL(newest.url).pathname));
  const download = await fetch(newest.url, { signal: AbortSignal.timeout(15 * 60_000) });
  if (!download.ok || !download.body) throw new Error(`SEPA archive responded ${download.status}`);
  // fetch types its body as the DOM stream; at run time it is Node's web stream.
  await pipeline(Readable.fromWeb(download.body as NodeReadableStream<Uint8Array>), createWriteStream(file));
  return file;
}

function filesNamed(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => pattern.test(basename(path)))
    .map((path) => join(dir, path))
    .sort();
}

const unzip = (zip: string, into: string) => execFileSync("unzip", ["-q", "-o", zip, "-d", into], { stdio: ["ignore", "ignore", "pipe"] });

async function main() {
  const out = argument("--out");
  if (!out) throw new Error("Usage: build-sepa.mts --out DIR [--zip FILE]");
  const work = mkdtempSync(join(tmpdir(), "sepa-"));
  try {
    const zip = argument("--zip") ?? (await downloadLatest(work));
    const outer = join(work, "outer");
    unzip(zip, outer);

    const chainZips = filesNamed(outer, /\.zip$/i);
    const date = chainZips.map((path) => /(\d{4}-\d{2}-\d{2})/.exec(path)?.[1]).find(Boolean);
    if (!date) throw new Error("Cannot tell the SEPA day from the archive");

    const collector = new SepaCollector();
    const skipped: string[] = [];
    for (const chainZip of chainZips) {
      const dir = join(work, "chain");
      rmSync(dir, { recursive: true, force: true });
      try {
        unzip(chainZip, dir);
        const [comercio, sucursales, productos] = ["comercio.csv", "sucursales.csv", "productos.csv"].map(
          (name) => filesNamed(dir, new RegExp(`^${name}$`, "i"))[0],
        );
        if (!comercio || !sucursales || !productos) throw new Error("missing comercio, sucursales or productos");
        collector.addChain(readFileSync(comercio, "utf8"), readFileSync(sucursales, "utf8"));
        const lines = createInterface({ input: createReadStream(productos, "utf8"), crlfDelay: Infinity });
        let first = true;
        for await (const line of lines) {
          if (first) collector.startPrices(line);
          else collector.addPriceLine(line);
          first = false;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
        console.warn(`Skipped ${basename(chainZip)}: ${message}`);
        skipped.push(basename(chainZip));
      }
    }

    const built = collector.build();
    console.log(`Stats ${JSON.stringify(built.stats)}`);
    const counts = {
      chains: built.branches.chains.length,
      branches: built.branches.branches.length,
      products: built.products.length,
      prices: built.stats.prices,
    };
    if (counts.products < MIN_PRODUCTS || counts.branches < MIN_BRANCHES) {
      throw new Error(`SEPA ${date} looks incomplete: ${JSON.stringify(counts)}`);
    }

    const files = sepaFiles(date);
    if (!existsSync(out)) mkdirSync(out, { recursive: true });
    writeFileSync(join(out, files.branches), JSON.stringify(built.branches));
    writeFileSync(join(out, files.products), gzipSync(JSON.stringify({ products: built.products }), { level: 9 }));
    writeFileSync(join(out, files.prices), built.prices);
    const latest: SepaLatest = { version: SEPA_VERSION, date, builtAt: new Date().toISOString(), files, counts, skipped };
    writeFileSync(join(out, LATEST_FILE), `${JSON.stringify(latest, null, 2)}\n`);
    console.log(`Wrote SEPA ${date} to ${out}: ${JSON.stringify(counts)}; skipped ${skipped.length}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

await main();
