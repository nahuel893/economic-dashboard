/**
 * Builds the committed EPH snapshots the Mapas tab reads: poverty and
 * indigence (half-yearly) and unemployment (quarterly) by aglomerado.
 *
 * INDEC publishes these tables only as legacy .xls (BIFF) files, which no
 * maintained npm reader opens, so each file is converted to .xlsx with
 * LibreOffice and read with read-excel-file.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/maps/eph-snapshots.mts
 *
 * Needs Node 23.6+ (runs TypeScript directly) and `soffice` on the PATH. To
 * refresh, add the new release to POVERTY_RELEASES (each adds a half-year) or
 * update UNEMPLOYMENT_FILE, run the script and commit the JSON it writes.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const FTP = "https://www.indec.gob.ar/ftp/cuadros/sociedad";

/**
 * Poverty report releases (MM_YY of publication), one half-year each. The
 * 09_26 release (1st half 2026) is the first with separate poverty (4.1) and
 * indigence (4.2) tables carrying exact CVs; earlier ones combine both in
 * Cuadro 4.1 and only flag a CV above 16%, a layout the parser does not read.
 */
const POVERTY_RELEASES = ["09_26"];

/** Labor-market report with the unemployment rate by aglomerado since 2016 (Cuadro 1.8). */
const UNEMPLOYMENT_FILE = `${FTP}/cuadros_eph_informe_09_26.xls`;

/** Quarters of unemployment the snapshot keeps. */
const QUARTERS = 12;

const SNAPSHOTS = new URL("../../src/lib/sources/snapshots/", import.meta.url);

// Resolve the app's `@/` alias and extensionless imports, so the parsers run as they do in the app.
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
const { ephPovertySeries, parseEphQuarterly } = await import("../../src/lib/sources/map-parsers");

const scratch = mkdtempSync(join(tmpdir(), "eph-snapshots-"));
console.log(`Scratch directory: ${scratch}`);

/** Downloads an INDEC .xls and returns the path of its .xlsx conversion. */
async function download(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; economic-dashboard)" } });
  if (!response.ok) throw new Error(`GET ${url} responded ${response.status}`);
  const xls = join(scratch, basename(new URL(url).pathname));
  writeFileSync(xls, Buffer.from(await response.arrayBuffer()));
  execFileSync(
    "soffice",
    [`-env:UserInstallation=${pathToFileURL(join(scratch, "lo-profile")).href}`, "--headless", "--convert-to", "xlsx", "--outdir", scratch, xls],
    { stdio: "ignore" },
  );
  return xls.replace(/\.xls$/, ".xlsx");
}

function write(name: string, sources: string[], series: unknown) {
  writeFileSync(new URL(name, SNAPSHOTS), `${JSON.stringify({ sources, series }, null, 2)}\n`);
  console.log(`Wrote src/lib/sources/snapshots/${name}`);
}

const povertyUrls = POVERTY_RELEASES.map((release) => `${FTP}/cuadros_informe_pobreza_${release}.xls`);
const releases = [];
for (const url of povertyUrls) {
  const file = await download(url);
  releases.push({ poverty: await readSheet(file, "Cuadro 4.1"), indigence: await readSheet(file, "Cuadro 4.2") });
}
const poverty = ephPovertySeries(releases);
write("eph-poverty.json", povertyUrls, poverty);
console.log(`  poverty: ${poverty.povertyPersons.periods.map((p) => p.period).join(", ")}`);

const unemployment = parseEphQuarterly(await readSheet(await download(UNEMPLOYMENT_FILE), "Cuadro 1.8"), QUARTERS);
write("eph-unemployment.json", [UNEMPLOYMENT_FILE], { unemployment });
console.log(`  unemployment: ${unemployment.periods.map((p) => p.period).join(", ")}`);
