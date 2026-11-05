/**
 * Builds the committed snapshot of INDEC's "Origen provincial de las
 * exportaciones" (OPEX) the Mapas tab reads: goods exports by province for the
 * first half of each year, in millions of USD, and their year-on-year change.
 *
 * INDEC publishes the tables only as a legacy .xls (BIFF) file, which no
 * maintained npm reader opens, so the file is converted to .xlsx with
 * LibreOffice and read with read-excel-file.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/maps/opex-snapshot.mts
 *
 * Needs Node 23.6+ (runs TypeScript directly) and `soffice` on the PATH. To
 * refresh, point OPEX_FILE at the annex of the latest first-half report
 * (opex_anexo_cuadros_<dd>_<mm>_<yy>.xls, published each September), run the
 * script and commit the JSON it writes.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const OPEX_FILE = "https://www.indec.gob.ar/ftp/cuadros/economia/opex_anexo_cuadros_02_09_26.xls";
const SHEET = "Region-prov 2016-2026 semestre";

const SNAPSHOT = new URL("../../src/lib/sources/snapshots/opex-exports.json", import.meta.url);

// Resolve the app's `@/` alias and extensionless imports, so the parser runs as it does in the app.
const SRC = new URL("../../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
    try {
      return next(target, context);
    } catch (error) {
      if (/^(\.|file:)/.test(target)) return next(`${target}.ts`, context);
      throw error;
    }
  },
});

const { readSheet } = await import("read-excel-file/node");
const { parseOpexSemesters } = await import("../../src/lib/sources/map-parsers");

const scratch = mkdtempSync(join(tmpdir(), "opex-snapshot-"));
console.log(`Scratch directory: ${scratch}`);

const response = await fetch(OPEX_FILE, { headers: { "User-Agent": "Mozilla/5.0 (compatible; economic-dashboard)" } });
if (!response.ok) throw new Error(`GET ${OPEX_FILE} responded ${response.status}`);
const xls = join(scratch, basename(new URL(OPEX_FILE).pathname));
writeFileSync(xls, Buffer.from(await response.arrayBuffer()));
execFileSync(
  "soffice",
  [`-env:UserInstallation=${pathToFileURL(join(scratch, "lo-profile")).href}`, "--headless", "--convert-to", "xlsx", "--outdir", scratch, xls],
  { stdio: "ignore" },
);

const series = parseOpexSemesters(await readSheet(xls.replace(/\.xls$/, ".xlsx"), SHEET));
writeFileSync(SNAPSHOT, `${JSON.stringify({ sources: [OPEX_FILE], series }, null, 2)}\n`);
console.log(`Wrote src/lib/sources/snapshots/opex-exports.json: ${series.total.periods.map((p) => p.period).join(", ")}`);
