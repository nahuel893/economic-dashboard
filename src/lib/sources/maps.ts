/**
 * Mapas sources. Each loader returns one MapSeries per value variant, keyed
 * by geography.ts: AreaId for wages, RegionId for inflation and the EPH
 * aglomerado code for poverty and unemployment. Runtime sources are cached
 * like the other clients; EPH data are committed snapshots (scripts/maps).
 */
import { readSheet } from "read-excel-file/node";
import { AREAS, REGIONS, type RegionId } from "@/lib/indicators/geography";
import type { MapSeries } from "@/lib/indicators/map-data";
import { attempt, CACHE, type Outcome, unwrap } from "./clients";
import { fetchJson } from "./http";
import {
  findOedeWorkbookUrl,
  parseOedeEmployment,
  parseOedeWages,
  type PovertySeries,
  regionalInflation,
  type Row,
} from "./map-parsers";
import { parseDatosSeries } from "./parsers";
import povertySnapshot from "./snapshots/eph-poverty.json";
import ratesSnapshot from "./snapshots/eph-rates.json";
import unemploymentSnapshot from "./snapshots/eph-unemployment.json";

/** Months of history each monthly map keeps. */
const MONTHS = 36;

/** OEDE index page that links the current wage and employment workbooks. */
const OEDE_INDEX_URL = "https://www.argentina.gob.ar/node/142211";

/** Known wage workbook, used when the index page fails or no longer links one. */
export const WAGES_URL =
  "https://www.argentina.gob.ar/sites/default/files/provinciales_serie_remuneraciones_mensual_2dig_9.xlsx";

/** The workbook is about 11 MB, well past the JSON helper's timeout. */
const FILE_TIMEOUT_MS = 30_000;

/** Like fetchJson in ./http, for a page or a file. */
async function fetchFile(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; economic-dashboard)" },
    signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GET ${new URL(url).host} responded ${response.status}`);
  return response;
}

/** The workbook of a file series linked from the OEDE index page, or the pinned one when the page fails or no longer links it. */
async function currentOedeUrl(stem: string, pinned: string): Promise<string> {
  try {
    return findOedeWorkbookUrl(await (await fetchFile(OEDE_INDEX_URL)).text(), stem) ?? pinned;
  } catch {
    return pinned;
  }
}

async function cachedWageMap(): Promise<Outcome<MapSeries>> {
  "use cache";
  return attempt(CACHE.slow, async () => {
    const workbook = Buffer.from(await (await fetchFile(await currentOedeUrl("provinciales_serie_remuneraciones_mensual_2dig", WAGES_URL))).arrayBuffer());
    return parseOedeWages(await readSheet(workbook, "Total"), MONTHS);
  });
}

/** Average registered private wage by area (OEDE/SIPA), in current pesos; June and December include the aguinaldo. */
export const getWageMap = async () => unwrap(await cachedWageMap());

/** Known quarterly employment workbook, used when the index page fails or no longer links one. */
export const EMPLOYMENT_URL =
  "https://www.argentina.gob.ar/sites/default/files/provinciales_serie_empleo_trimestral_2dig_7.xlsx";

/** Quarters of employment the map keeps: the same three years as the monthly maps. */
const QUARTERS = MONTHS / 3;

/** Sheet of each area in the employment workbook: Buenos Aires is split in three, the others are named without accents. */
export const EMPLOYMENT_SHEETS: Record<string, string> = Object.fromEntries(
  AREAS.map(({ id, name }) => [id, name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")]),
);
EMPLOYMENT_SHEETS["02"] = "CABA";
EMPLOYMENT_SHEETS["06-gba"] = "Partidos de GBA";

async function cachedEmploymentMap(): Promise<Outcome<{ jobs: MapSeries; yearOnYear: MapSeries }>> {
  "use cache";
  return attempt(CACHE.slow, async () => {
    const workbook = Buffer.from(
      await (await fetchFile(await currentOedeUrl("provinciales_serie_empleo_trimestral_2dig", EMPLOYMENT_URL))).arrayBuffer(),
    );
    const sheets: Record<string, Row[]> = {};
    for (const [area, sheet] of Object.entries(EMPLOYMENT_SHEETS)) sheets[area] = await readSheet(workbook, sheet);
    return parseOedeEmployment(sheets, QUARTERS);
  });
}

/** Registered private employment by area (OEDE/SIPA): jobs and their year-on-year change, quarterly. */
export const getEmploymentMap = async () => unwrap(await cachedEmploymentMap());

/**
 * General-level IPC by region, base December 2016, monthly. The 148.3_* ids
 * carry the same levels but their Noroeste series is empty, so all six use 145.3_*.
 */
export const IPC_REGION_SERIES: Record<RegionId, string> = {
  GBA: "145.3_INGGBAGBA_DICI_M_10",
  Pampeana: "145.3_INGPAMANA_DICI_M_15",
  NOA: "145.3_INGNOANOA_DICI_M_10",
  NEA: "145.3_INGNEANEA_DICI_M_10",
  Cuyo: "145.3_INGCUYUYO_DICI_M_11",
  Patagonia: "145.3_INGPATNIA_DICI_M_16",
};

async function cachedRegionalInflationMap(): Promise<Outcome<{ monthly: MapSeries; yearOnYear: MapSeries }>> {
  "use cache";
  return attempt(CACHE.daily, async () => {
    const ids = REGIONS.map((r) => IPC_REGION_SERIES[r.id]);
    const raw = await fetchJson<Parameters<typeof parseDatosSeries>[0]>(
      `https://apis.datos.gob.ar/series/api/series/?ids=${ids.join(",")}&format=json&limit=5000`,
    );
    return regionalInflation(parseDatosSeries(raw, ids.length), MONTHS);
  });
}

/** Monthly and year-on-year inflation by IPC region (INDEC via datos.gob.ar), in %. */
export const getRegionalInflationMap = async () => unwrap(await cachedRegionalInflationMap());

/** Poverty and indigence by aglomerado, % of persons and of households with CVs, half-yearly (INDEC EPH). */
export const getEphPovertyMap = async () => povertySnapshot.series as PovertySeries;

/** Unemployment rate by aglomerado, %, quarterly (INDEC EPH). */
export const getUnemploymentMap = async () => unemploymentSnapshot.series.unemployment as MapSeries;

/** Activity and employment rates by aglomerado, % of the population, quarterly (INDEC EPH; no CV is published). */
export const getLaborRatesMap = async () => ratesSnapshot.series as { activity: MapSeries; employment: MapSeries };
