/**
 * Parsers of the Mapas sources: plain rows (as read-excel-file returns them)
 * or API points in, MapSeries keyed by geography.ts out. Pure, shared by the
 * runtime loaders (maps.ts) and the EPH snapshot script (scripts/maps).
 */
import { changeOverMonths } from "@/lib/indicators/calc";
import { AGLOMERADOS, AREAS, REGIONS } from "@/lib/indicators/geography";
import type { MapPeriod, MapSeries, MapValue } from "@/lib/indicators/map-data";
import type { Point } from "@/lib/indicators/types";

/** A spreadsheet row; cells are strings, numbers, Dates or null. */
export type Row = readonly unknown[];

/** Lowercase, without accents, footnote marks or spacing differences around hyphens. */
export function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(\d+\)|\*/g, "")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const label = (cell: unknown) => (typeof cell === "string" ? cell : null);
const number = (cell: unknown) => (typeof cell === "number" && Number.isFinite(cell) ? cell : null);

/* ---------------------------------- OEDE ---------------------------------- */

/**
 * OEDE "Total" sheet rows mapped to map areas. OEDE's "GRAN BUENOS AIRES" row
 * is the 24 partidos without the city (its own sheet is titled "Gran Buenos
 * Aires -sin CABA-"), and its "BUENOS AIRES" row equals the "Resto Pcia. Bs.
 * As." sheet total, so both halves of the province come straight from OEDE
 * and nothing is imputed. Every other row is a province, matched by name.
 */
const OEDE_SPECIAL: Record<string, string> = {
  "capital federal": "02",
  "gran buenos aires": "06-gba",
  "buenos aires": "06-resto",
};

const OEDE_AREAS = new Map<string, string>([
  ...AREAS.filter((a) => a.province !== "02" && a.province !== "06").map((a) => [normalizeLabel(a.name), a.id] as const),
  ...Object.entries(OEDE_SPECIAL),
]);

/** Months whose wages include the aguinaldo (sueldo anual complementario). */
const AGUINALDO_MONTHS = new Set(["06", "12"]);

/** UTC month of a header cell: a Date, as read-excel-file returns date cells. */
function headerMonth(cell: unknown): string | null {
  return cell instanceof Date ? cell.toISOString().slice(0, 7) : null;
}

/**
 * Average registered private wage by area from the OEDE "Total" sheet (one row
 * per province, one column per month), keeping the last `months` months that
 * have data. Fails on a row it cannot place and on an area without a row.
 */
export function parseOedeWages(rows: Row[], months: number): MapSeries {
  const header = rows.findIndex((row) => label(row[0])?.trim().toLowerCase() === "provincia");
  if (header < 0) throw new Error("OEDE wages: header row not found");
  const columns = rows[header].flatMap((cell, index) => {
    const month = headerMonth(cell);
    return month ? [{ index, month }] : [];
  });

  const byMonth = new Map<string, Record<string, MapValue>>(columns.map((c) => [c.month, {}]));
  const seen = new Set<string>();
  for (const row of rows.slice(header + 1)) {
    const name = label(row[0]);
    if (!name || !columns.some((c) => number(row[c.index]) !== null)) continue;
    const key = normalizeLabel(name);
    if (key === "total") break;
    const area = OEDE_AREAS.get(key);
    if (!area) throw new Error(`OEDE wages: unknown province row "${name.trim()}"`);
    seen.add(area);
    for (const { index, month } of columns) {
      const value = number(row[index]);
      if (value !== null) byMonth.get(month)![area] = { value };
    }
  }
  const missing = AREAS.find((a) => !seen.has(a.id));
  if (missing) throw new Error(`OEDE wages: no row for ${missing.id}`);

  const periods = [...byMonth]
    .filter(([, values]) => Object.keys(values).length)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, values]): MapPeriod =>
      AGUINALDO_MONTHS.has(period.slice(5)) ? { period, values, note: "Incluye aguinaldo" } : { period, values },
    );
  return { periods: periods.slice(-months) };
}

const OEDE_ORIGIN = "https://www.argentina.gob.ar";

/** The current workbook of a file series (`stem_<n>.xlsx`) linked from the OEDE index page; its numeric suffix changes. */
export function findOedeWorkbookUrl(html: string, stem: string): string | null {
  const path = html.match(new RegExp(`/sites/default/files/${stem}_\\d+\\.xlsx`))?.[0];
  return path ? `${OEDE_ORIGIN}${path}` : null;
}

/** The current monthly 2-digit wage workbook. */
export const findWageWorkbookUrl = (html: string) => findOedeWorkbookUrl(html, "provinciales_serie_remuneraciones_mensual_2dig");

/**
 * Registered private employment by area from the OEDE quarterly workbook, which
 * has one sheet per province (Buenos Aires split in "Partidos de GBA", "CABA"
 * and "Resto de Buenos Aires", the same split as the wages) with the jobs of
 * every quarter on a TOTAL row. `sheets` holds the rows of each area's sheet,
 * keyed by area. Returns the number of jobs and the year-on-year % change, both
 * keeping the last `quarters` quarters that have data (the change needs the
 * four quarters before the first one).
 */
export function parseOedeEmployment(
  sheets: Record<string, Row[]>,
  quarters: number,
): { jobs: MapSeries; yearOnYear: MapSeries } {
  const jobsByArea = new Map<string, Map<string, number>>();
  for (const { id } of AREAS) {
    const rows = sheets[id];
    if (!rows) throw new Error(`OEDE employment: no sheet for ${id}`);
    const header = rows.findIndex((row) => label(row[1])?.trim().toLowerCase() === "ramas de actividad");
    if (header < 0) throw new Error(`OEDE employment: header row not found in the sheet of ${id}`);
    const total = rows.find((row) => label(row[1]) !== null && normalizeLabel(label(row[1])!) === "total");
    if (!total) throw new Error(`OEDE employment: TOTAL row not found in the sheet of ${id}`);
    const jobs = new Map<string, number>();
    rows[header].forEach((cell, index) => {
      const quarter = typeof cell === "string" ? cell.match(/(\d)\D*Trim\D*(\d{4})/i) : null;
      const value = number(total[index]);
      if (quarter && value !== null) jobs.set(`${quarter[2]}-Q${quarter[1]}`, value);
    });
    jobsByArea.set(id, jobs);
  }

  const toSeries = (valueOf: (jobs: Map<string, number>, period: string) => number | null): MapSeries => {
    const byPeriod = new Map<string, Record<string, MapValue>>();
    for (const [area, jobs] of jobsByArea) {
      for (const period of jobs.keys()) {
        const value = valueOf(jobs, period);
        if (value !== null) byPeriod.set(period, { ...byPeriod.get(period), [area]: { value } });
      }
    }
    const periods = [...byPeriod].sort(([a], [b]) => a.localeCompare(b)).slice(-quarters);
    return { periods: periods.map(([period, values]) => ({ period, values })) };
  };

  return {
    jobs: toSeries((jobs, period) => jobs.get(period) ?? null),
    yearOnYear: toSeries((jobs, period) => {
      const before = jobs.get(`${Number(period.slice(0, 4)) - 1}${period.slice(4)}`);
      return before ? (jobs.get(period)! / before - 1) * 100 : null;
    }),
  };
}

/* ----------------------------------- IPC ---------------------------------- */

/**
 * Monthly and year-on-year % change by IPC region, from index levels given in
 * the order of REGIONS (geography.ts); keeps the last `months` months.
 */
export function regionalInflation(levels: Point[][], months: number): { monthly: MapSeries; yearOnYear: MapSeries } {
  const toSeries = (lag: number): MapSeries => {
    const byMonth = new Map<string, Record<string, MapValue>>();
    REGIONS.forEach(({ id: region }, i) => {
      for (const { date, value } of changeOverMonths(levels[i], lag)) {
        const month = date.slice(0, 7);
        byMonth.set(month, { ...byMonth.get(month), [region]: { value } });
      }
    });
    const periods = [...byMonth].sort(([a], [b]) => a.localeCompare(b)).slice(-months);
    return { periods: periods.map(([period, values]) => ({ period, values })) };
  };
  return { monthly: toSeries(1), yearOnYear: toSeries(12) };
}

/* ----------------------------------- EPH ---------------------------------- */

/** XLS spellings that differ from geography.ts beyond accents, case and hyphen spacing. */
const EPH_ALIASES: Record<string, string> = {
  salta: "23",
  "partidos del gran buenos aires": "33",
};

const EPH_CODES = new Map<string, string>([
  ...AGLOMERADOS.map((a) => [normalizeLabel(a.name), a.code] as const),
  ...Object.entries(EPH_ALIASES),
]);

/** Rows of the EPH tables that are regions or totals, not aglomerados. */
const EPH_AGGREGATES = new Set(
  ["Aglomerados del interior", "Regiones", "Gran Buenos Aires", "Cuyo", "Noreste", "Noroeste", "Pampeana", "Patagonia"].map(
    normalizeLabel,
  ),
);

/**
 * The aglomerado rows of an EPH table, by code. A labelled row with data that
 * is neither an aglomerado nor a known aggregate fails, and so does a table
 * missing an aglomerado, so a renamed row never drops silently.
 */
function aglomeradoRows(rows: Row[], hasData: (row: Row) => boolean): Map<string, Row> {
  const found = new Map<string, Row>();
  for (const row of rows) {
    const name = label(row[0]);
    if (!name) continue;
    const key = normalizeLabel(name);
    const code = EPH_CODES.get(key);
    if (code) found.set(code, row);
    else if (hasData(row) && !key.startsWith("total") && !EPH_AGGREGATES.has(key)) {
      throw new Error(`EPH: unknown aglomerado row "${name.trim()}"`);
    }
  }
  const missing = AGLOMERADOS.find((a) => !found.has(a.code));
  if (missing) throw new Error(`EPH: no row for aglomerado ${missing.code} (${missing.name})`);
  return found;
}

const HALVES: Record<string, string> = { primer: "H1", segundo: "H2" };

/** One half-year table (Cuadro 4.1 or 4.2): incidence and CV of households and persons. */
function parseHalfYear(rows: Row[]) {
  const title = rows.map((row) => label(row[0])).find((cell) => cell && /semestre de \d{4}/i.test(cell)) ?? "";
  const [, half, year] = title.match(/(primer|segundo) semestre de (\d{4})/i) ?? [];
  if (!half) throw new Error("EPH: half-year not found in the table title");
  const period = `${year}-${HALVES[half.toLowerCase()]}`;

  const groups = rows.findIndex((row) => row.includes("Hogares") && row.includes("Personas"));
  if (groups < 0) throw new Error("EPH: Hogares/Personas header not found");
  const sub = rows[groups + 1] ?? [];
  const columnsOf = (group: string) => {
    const start = rows[groups].indexOf(group);
    const incidence = sub.indexOf("Incidencia", start);
    const cv = sub.indexOf("CV", incidence);
    if (incidence < 0 || cv < 0) throw new Error(`EPH: Incidencia/CV columns not found for ${group}`);
    return { incidence, cv };
  };
  const households = columnsOf("Hogares");
  const persons = columnsOf("Personas");

  const byCode = aglomeradoRows(rows.slice(groups + 2), (row) => row.slice(1).some((cell) => number(cell) !== null));
  const values = (columns: { incidence: number; cv: number }) => {
    const out: Record<string, MapValue> = {};
    for (const [code, row] of byCode) {
      const value = number(row[columns.incidence]);
      const cv = number(row[columns.cv]);
      if (value !== null) out[code] = cv === null ? { value } : { value, cv };
    }
    return out;
  };
  return { period, households: values(households), persons: values(persons) };
}

export type PovertySeries = {
  povertyPersons: MapSeries;
  povertyHouseholds: MapSeries;
  indigencePersons: MapSeries;
  indigenceHouseholds: MapSeries;
};

/**
 * Poverty and indigence by aglomerado from several releases of the INDEC
 * poverty report, each giving one half-year in Cuadro 4.1 (poverty) and 4.2
 * (indigence). Periods come out in ascending order.
 */
export function ephPovertySeries(releases: { poverty: Row[]; indigence: Row[] }[]): PovertySeries {
  const tables = releases
    .map(({ poverty, indigence }) => {
      const p = parseHalfYear(poverty);
      const i = parseHalfYear(indigence);
      if (p.period !== i.period) throw new Error(`EPH: poverty is ${p.period} but indigence is ${i.period}`);
      return { period: p.period, p, i };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
  tables.forEach((t, k) => {
    if (tables[k - 1]?.period === t.period) throw new Error(`EPH: half-year ${t.period} appears twice`);
  });
  const series = (pick: (t: (typeof tables)[number]) => Record<string, MapValue>): MapSeries => ({
    periods: tables.map((t) => ({ period: t.period, values: pick(t) })),
  });
  return {
    povertyPersons: series((t) => t.p.persons),
    povertyHouseholds: series((t) => t.p.households),
    indigencePersons: series((t) => t.i.persons),
    indigenceHouseholds: series((t) => t.i.households),
  };
}

/**
 * A quarterly EPH table by aglomerado (e.g. Cuadro 1.8, unemployment rate):
 * a row of "Año YYYY" cells spanning their quarters and a row of "1°".."4°"
 * cells, possibly with footnote marks. Keeps the last `quarters` quarters;
 * cells without a number (e.g. "///", too few cases) are left out.
 */
export function parseEphQuarterly(rows: Row[], quarters: number): MapSeries {
  const yearsRow = rows.findIndex((row) => row.some((cell) => /^Año \d{4}/.test(label(cell) ?? "")));
  if (yearsRow < 0) throw new Error("EPH: year header not found");
  const quarterRow = rows.findIndex((row, i) => i > yearsRow && row.some((cell) => /^[1-4]°/.test(label(cell) ?? "")));
  if (quarterRow < 0) throw new Error("EPH: quarter header not found");

  const columns: { index: number; period: string }[] = [];
  let year: string | undefined;
  rows[quarterRow].forEach((cell, index) => {
    year = label(rows[yearsRow][index])?.match(/\d{4}/)?.[0] ?? year;
    const quarter = label(cell)?.match(/^([1-4])°/)?.[1];
    if (quarter && year) columns.push({ index, period: `${year}-Q${quarter}` });
  });
  const kept = columns.sort((a, b) => a.period.localeCompare(b.period)).slice(-quarters);

  const byCode = aglomeradoRows(rows.slice(quarterRow + 1), (row) => columns.some((c) => number(row[c.index]) !== null));
  return {
    periods: kept.map(({ index, period }) => {
      const values: Record<string, MapValue> = {};
      for (const [code, row] of byCode) {
        const value = number(row[index]);
        if (value !== null) values[code] = { value };
      }
      return { period, values };
    }),
  };
}

/* ------------------------------ Census 2022 ------------------------------- */

/** Period key of the census values: the year, since INDEC publishes them once. */
export const CENSUS_PERIOD = "2022";

const CENSUS_NOTE =
  "No incluye la Antártida Argentina ni las islas del Atlántico Sur, que no se dibujan (81 personas censadas en bases antárticas)";

/**
 * Population and density by department from INDEC's provincial tables "Total
 * de población y densidad, por superficie, según departamento" (one sheet per
 * province: code, name, area in km², population, density). The code is a number
 * without its leading zero for Buenos Aires and Ciudad de Buenos Aires; the
 * province's total, Buenos Aires's sub-totals and Tierra del Fuego's Antarctic
 * split have no five-digit department code and are skipped, and so is 94028
 * (Antártida Argentina e Islas del Atlántico Sur), for which INDEC gives no
 * density and which the map does not draw. Density is INDEC's own, to one decimal.
 */
export function censusSeries(sheets: Row[][]): { population: MapSeries; density: MapSeries } {
  const population: Record<string, MapValue> = {};
  const density: Record<string, MapValue> = {};
  for (const row of sheets.flat()) {
    const [code, , , people, perKm2] = row;
    const numericCode = typeof code === "string" && /^\d+$/.test(code) ? Number(code) : code;
    if (typeof numericCode !== "number" || numericCode < 1000) continue;
    const id = String(numericCode).padStart(5, "0");
    const peopleCount = number(people);
    const perKm2Value = number(perKm2);
    if (peopleCount === null || perKm2Value === null) continue;
    if (id in population) throw new Error(`Census department ${id} appears twice`);
    population[id] = { value: peopleCount };
    density[id] = { value: Math.round(perKm2Value * 10) / 10 };
  }
  return {
    population: { periods: [{ period: CENSUS_PERIOD, values: population, note: CENSUS_NOTE }] },
    density: { periods: [{ period: CENSUS_PERIOD, values: density, note: CENSUS_NOTE }] },
  };
}
