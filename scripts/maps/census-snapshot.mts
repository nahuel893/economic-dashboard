/**
 * Builds the committed Census 2022 snapshot the Mapas tab reads: population
 * and density (inhabitants per km²) by department, partido or comuna, from
 * INDEC's definitive results (published at censo.gob.ar, one workbook per
 * province: "Total de población y densidad, por superficie, según departamento").
 * INDEC publishes no NBI table by department for this census, so there is none.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/maps/census-snapshot.mts [--from DIR]
 *
 * Needs Node 23.6+ (runs TypeScript directly). censo.gob.ar does not send its
 * intermediate certificate, so Node cannot verify the site by default: download
 * the 24 files listed in CENSUS_FILES yourself and pass their directory with
 * --from (or make Node trust the chain with NODE_EXTRA_CA_CERTS). The data is
 * fixed, so this only needs to run again if INDEC corrects the tables.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { join } from "node:path";

const BASE = "https://censo.gob.ar/wp-content/uploads/2023/11";

/** The department table of each province, in INDEC's jurisdiction order (Cuadro 2.N, N = jurisdiction number). */
const CENSUS_FILES = [
  "c2022_caba_est_c2_1", "c2022_bsas_est_c2_2", "c2022_catamarca_est_c2_3", "c2022_chaco_est_c2_4",
  "c2022_chubut_est_c2_5", "c2022_cordoba_est_c2_6", "c2022_corrientes_est_c2_7", "c2022_entrerios_est_c2_8",
  "c2022_formosa_est_c2_9", "c2022_jujuy_est_c2_10", "c2022_lapampa_est_c2_11", "c2022_larioja_est_c2_12",
  "c2022_mendoza_est_c2_13", "c2022_misiones_est_c2_14", "c2022_neuquen_est_c2_15", "c2022_rionegro_est_c2_16",
  "c2022_salta_est_c2_17", "c2022_sanjuan_est_c2_18", "c2022_sanluis_est_c2_19", "c2022_santacruz_est_c2_20",
  "c2022_santafe_est_c2_21", "c2022_santiago_est_c2_22", "c2022_tdf_est_c2_23", "c2022_tucuman_est_c2_24",
].map((name) => `${name}.xlsx`);

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
const { censusSeries } = await import("../../src/lib/sources/map-parsers");
const places: { id: string }[] = JSON.parse(readFileSync(new URL("department-places.json", SNAPSHOTS), "utf8"));

const fromIndex = process.argv.indexOf("--from");
const directory = fromIndex === -1 ? null : process.argv[fromIndex + 1];

async function workbook(file: string): Promise<string | Buffer> {
  if (directory) return join(directory, file);
  const response = await fetch(`${BASE}/${file}`, { headers: { "User-Agent": "Mozilla/5.0 (compatible; economic-dashboard)" } });
  if (!response.ok) throw new Error(`GET ${BASE}/${file} responded ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const sheets = [];
for (const file of CENSUS_FILES) sheets.push(await readSheet(await workbook(file), 3)); // the table is the third sheet
const series = censusSeries(sheets);

// Every drawn department has a value and every value is drawn: report anything else instead of hiding it.
const drawn = new Set(places.map((p) => p.id));
const counted = new Set(Object.keys(series.population.periods[0].values));
const unmatched = [...counted].filter((id) => !drawn.has(id));
const missing = [...drawn].filter((id) => !counted.has(id));
if (unmatched.length || missing.length) {
  throw new Error(`Census and geometry disagree. Without geometry: ${unmatched}. Without census: ${missing}`);
}

const sources = CENSUS_FILES.map((file) => `${BASE}/${file}`);
writeFileSync(new URL("census.json", SNAPSHOTS), `${JSON.stringify({ sources, series }, null, 2)}\n`);
const total = Object.values(series.population.periods[0].values).reduce((sum, v) => sum + v.value, 0);
console.log(`Wrote src/lib/sources/snapshots/census.json: ${counted.size} departments, ${total} people`);
