/**
 * The "Panel" tab: one screen with the key indicators and a grid of charts,
 * all driven by the same period. Every chart uses the close of each month, so
 * daily and monthly series share one axis and the hover follows the same month
 * on every chart.
 */
import type { Unit } from "@/lib/format";
import { downsample, inRange, periodChange, type MonthRange } from "./history";
import type { HistorySnapshot, HistoryVariable } from "./history-data";
import type { Point } from "./types";

export type PanelPoint = { month: string; value: number };

export type PanelVariable = {
  key: string;
  label: string;
  description: string;
  unit: Unit;
  change: HistoryVariable["change"];
  frequency: HistoryVariable["frequency"];
  source: string;
  status: "ok" | "error";
  message?: string;
  /** Close of each month in the period. */
  points: PanelPoint[];
  /** Latest observation in the period, with its exact date. */
  last: Point | null;
  /** Change over the period, computed on every observation in it. */
  periodChange: number | null;
};

export type PanelChart = {
  key: string;
  title: string;
  description: string;
  /** Variable keys, drawn in this order; all share the chart's unit. */
  series: string[];
  /** Shorter legend labels, when the chart title already says what they share. */
  labels?: Record<string, string>;
};

/** Key indicators, in reading order: the dollar, prices and activity, then risk, reserves and rates. */
export const PANEL_KPIS = [
  "blue",
  "oficial",
  "ccl",
  "gap",
  "monthlyInflation",
  "yearlyInflation",
  "activityYearly",
  "countryRisk",
  "reserves",
  "badlar",
] as const;

export const PANEL_CHARTS: PanelChart[] = [
  {
    key: "dollars",
    title: "Dólares",
    description: "Precio de venta, cierre de cada mes.",
    series: ["oficial", "blue", "mep", "ccl"],
    labels: { oficial: "Oficial", blue: "Blue", mep: "MEP", ccl: "CCL" },
  },
  { key: "gap", title: "Brecha CCL vs. oficial", description: "Cuánto más caro está el CCL que el oficial.", series: ["gap"] },
  {
    key: "ratesVsInflation",
    title: "Tasa vs. inflación",
    description: "Si la BADLAR queda debajo de la inflación interanual, el ahorro en pesos pierde contra los precios.",
    series: ["badlar", "yearlyInflation"],
  },
  { key: "activityYearly", title: "Actividad, variación interanual", description: "EMAE contra el mismo mes del año anterior.", series: ["activityYearly"] },
  { key: "monthlyInflation", title: "Inflación mensual", description: "Variación del IPC contra el mes anterior.", series: ["monthlyInflation"] },
  { key: "activity", title: "Nivel de actividad", description: "EMAE desestacionalizado, base 2004 = 100.", series: ["activity"] },
  { key: "countryRisk", title: "Riesgo país", description: "EMBI de J.P. Morgan, en puntos básicos.", series: ["countryRisk"] },
  { key: "reserves", title: "Reservas internacionales", description: "Reservas brutas del BCRA, en millones de dólares.", series: ["reserves"] },
];

/** Monthly changes read as columns; levels and rates, as lines. */
const BAR_VARIABLES = new Set(["monthlyInflation", "activityYearly"]);

/** How a chart of these variables is drawn: columns only when every series is a monthly change. */
export const chartKind = (series: string[]): "line" | "bar" =>
  series.every((key) => BAR_VARIABLES.has(key)) ? "bar" : "line";

export type Panel = { range: MonthRange; variables: Record<string, PanelVariable> };

const monthlyCloses = (points: Point[]): PanelPoint[] =>
  downsample(points, "monthly").map((p) => ({ month: p.date.slice(0, 7), value: p.value }));

function toPanelVariable(variable: HistoryVariable, range: MonthRange): PanelVariable {
  const { key, label, description, unit, change, frequency, indicator } = variable;
  const base = { key, label, description, unit, change, frequency, source: indicator.source };
  if (indicator.status === "error") {
    return { ...base, status: "error", message: indicator.message, points: [], last: null, periodChange: null };
  }
  const points = inRange(indicator.data, range).sort((a, b) => a.date.localeCompare(b.date));
  return {
    ...base,
    status: "ok",
    points: monthlyCloses(points),
    last: points.at(-1) ?? null,
    periodChange: periodChange(points, change),
  };
}

export function buildPanel(snapshot: HistorySnapshot, range: MonthRange): Panel {
  const variables = Object.fromEntries(
    snapshot.groups.flatMap((group) => group.variables).map((v) => [v.key, toPanelVariable(v, range)]),
  );
  return { range, variables };
}

export type MonthRow = { month: string } & Record<string, number | string>;

/** One row per month with a column per series; months a series lacks are left out of its column. */
export function mergeByMonth(series: { key: string; points: PanelPoint[] }[]): MonthRow[] {
  const rows = new Map<string, MonthRow>();
  for (const { key, points } of series) {
    for (const { month, value } of points) rows.set(month, { ...(rows.get(month) ?? { month }), [key]: value });
  }
  return [...rows.values()].sort((a, b) => a.month.localeCompare(b.month));
}
