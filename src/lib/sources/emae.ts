import { monthEnd } from "@/lib/indicators/history";
import type { Point } from "@/lib/indicators/types";
import type { XlsRows } from "./xls";

/**
 * INDEC's EMAE workbook, base 2004. INDEC updates it on release day, usually
 * days before the series API of datos.gob.ar, and revises the whole series
 * each time, so every EMAE chart of a page should read the same file.
 */
export const EMAE_XLS_URL = "https://www.indec.gob.ar/ftp/cuadros/economia/sh_emae_mensual_base2004.xls";

export type EmaeSeries = { original: Point[]; seasonallyAdjusted: Point[]; trendCycle: Point[] };

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Header row and the column of each index; the columns in between hold INDEC's own changes. */
const HEADER_ROW = 2;
const COLUMNS = { original: 2, seasonallyAdjusted: 4, trendCycle: 6 } as const;
const HEADERS = { original: "Serie Original", seasonallyAdjusted: "Serie Desestacionalizada", trendCycle: "Serie Tendencia-Ciclo" };

/**
 * The three EMAE indexes of the workbook. Rows run month by month from January
 * 2004; the year is written only on January rows. Any change of layout throws
 * rather than mislabel a series or a month.
 */
export function parseIndecEmae(rows: XlsRows): EmaeSeries {
  const header = rows[HEADER_ROW] ?? [];
  for (const key of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) {
    const cell = header[COLUMNS[key]];
    if (typeof cell !== "string" || !cell.includes(HEADERS[key])) {
      throw new Error(`EMAE columns changed: expected "${HEADERS[key]}" in column ${COLUMNS[key] + 1}`);
    }
  }

  const series: EmaeSeries = { original: [], seasonallyAdjusted: [], trendCycle: [] };
  let year: number | undefined;
  let month = 0;
  for (const row of rows.slice(HEADER_ROW + 1)) {
    if (!row || typeof row[COLUMNS.original] !== "number") {
      if (year === undefined) continue;
      break;
    }
    if (typeof row[0] === "number") {
      if (year !== undefined && (row[0] !== year + 1 || month !== 11)) {
        throw new Error(`EMAE workbook jumps from ${MONTHS[month]} ${year} to ${row[0]}`);
      }
      year = row[0];
      month = 0;
    } else if (year === undefined) {
      throw new Error("EMAE workbook has data before its first year");
    } else if (++month === 12) {
      throw new Error(`EMAE workbook has no year after December ${year}`);
    }
    if (row[1] !== MONTHS[month]) {
      throw new Error(`EMAE workbook has "${String(row[1])}" where it expected ${MONTHS[month]} ${year}`);
    }
    const date = monthEnd(`${year}-${String(month + 1).padStart(2, "0")}-01`);
    for (const key of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) {
      const value = row[COLUMNS[key]];
      if (typeof value !== "number") throw new Error(`EMAE workbook has no ${HEADERS[key]} for ${MONTHS[month]} ${year}`);
      series[key].push({ date, value });
    }
  }
  if (!series.original.length) throw new Error("EMAE workbook has no data");
  return series;
}
