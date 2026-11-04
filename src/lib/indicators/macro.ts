import { cacheLife } from "next/cache";
import type { Unit } from "@/lib/format";
import { CACHE, INDEC_SERIES, SOURCES, getBcraSeries, getIndecMonthlySeries } from "@/lib/sources/clients";
import { changeOverMonths, lastN, realRate, tnaToTea, toSeries, type Series } from "./calc";
import { settle } from "./settle";
import type { Indicator, Point } from "./types";

/** How a change is shown: relative change in percent, or absolute change in percentage points. */
export type DeltaMode = "percent" | "points";
export type Frequency = "daily" | "monthly";

/**
 * Where a variable comes from: an id in BCRA Estadísticas v4 ("Principales
 * Variables"), or an INDEC index on datos.gob.ar shown as its change over 12
 * months ("yoy") or over the previous month ("mom").
 */
type MacroSource = { kind: "bcra"; id: number } | { kind: "indec"; seriesId: string; change: "yoy" | "mom" };

const bcra = (id: number): MacroSource => ({ kind: "bcra", id });
const indec = (seriesId: string, change: "yoy" | "mom"): MacroSource => ({ kind: "indec", seriesId, change });

type MacroVariable = {
  key: string;
  source: MacroSource;
  label: string;
  unit: Unit;
  delta: DeltaMode;
  frequency: Frequency;
  note?: string;
  /** Monthly columns with a value label on each bar, instead of a sparkline. */
  chart?: "columns";
};

export type MacroGroupId = "money" | "inflation" | "activity" | "rates" | "indexes";

const GROUPS: { id: MacroGroupId; title: string; description: string; variables: MacroVariable[] }[] = [
  {
    id: "money",
    title: "Reservas y dinero",
    description: "Dólares del BCRA y pesos que circulan en la economía.",
    variables: [
      { key: "reserves", source: bcra(1), label: "Reservas internacionales", unit: "usdMillions", delta: "percent", frequency: "daily" },
      { key: "monetaryBase", source: bcra(15), label: "Base monetaria", unit: "arsMillions", delta: "percent", frequency: "daily" },
      { key: "m2", source: bcra(25), label: "M2 privado, variación interanual", unit: "percent", delta: "points", frequency: "daily", note: "Promedio móvil de 30 días" },
      { key: "deposits", source: bcra(21), label: "Depósitos totales", unit: "arsMillions", delta: "percent", frequency: "daily" },
      { key: "timeDeposits", source: bcra(24), label: "Depósitos a plazo", unit: "arsMillions", delta: "percent", frequency: "daily" },
      { key: "privateLoans", source: bcra(26), label: "Préstamos al sector privado", unit: "arsMillions", delta: "percent", frequency: "daily" },
    ],
  },
  {
    id: "inflation",
    title: "Inflación",
    description: "Dato del INDEC informado por el BCRA y lo que espera el mercado.",
    variables: [
      { key: "monthlyInflation", source: bcra(27), label: "Inflación mensual", unit: "percent", delta: "points", frequency: "monthly", chart: "columns" },
      { key: "yearlyInflation", source: bcra(28), label: "Inflación interanual", unit: "percent", delta: "points", frequency: "monthly", chart: "columns" },
      { key: "expectedInflation", source: bcra(29), label: "Inflación esperada a 12 meses", unit: "percent", delta: "points", frequency: "monthly", note: "Mediana del REM", chart: "columns" },
    ],
  },
  {
    id: "activity",
    title: "Actividad económica",
    description: "El PBI mes a mes: Estimador Mensual de Actividad Económica (EMAE) del INDEC.",
    variables: [
      { key: "activityYearly", source: indec(INDEC_SERIES.emae, "yoy"), label: "Actividad, variación interanual", unit: "percent", delta: "points", frequency: "monthly", note: "Contra el mismo mes del año anterior", chart: "columns" },
      { key: "activityMonthly", source: indec(INDEC_SERIES.emaeSeasonallyAdjusted, "mom"), label: "Actividad, variación mensual", unit: "percent", delta: "points", frequency: "monthly", note: "Serie desestacionalizada", chart: "columns" },
    ],
  },
  {
    id: "rates",
    title: "Tasas de interés",
    description: "Tasas nominales anuales (TNA) en pesos.",
    variables: [
      { key: "termDeposit", source: bcra(12), label: "Plazo fijo a 30 días", unit: "percent", delta: "points", frequency: "daily" },
      { key: "tamar", source: bcra(44), label: "TAMAR bancos privados", unit: "percent", delta: "points", frequency: "daily" },
      { key: "badlar", source: bcra(7), label: "BADLAR bancos privados", unit: "percent", delta: "points", frequency: "daily" },
      { key: "personalLoans", source: bcra(14), label: "Préstamos personales", unit: "percent", delta: "points", frequency: "daily" },
      { key: "overdraft", source: bcra(13), label: "Adelantos en cuenta corriente", unit: "percent", delta: "points", frequency: "daily" },
    ],
  },
  {
    id: "indexes",
    title: "Índices de ajuste",
    description: "Unidades que actualizan créditos, bonos y alquileres.",
    variables: [
      { key: "uva", source: bcra(31), label: "UVA", unit: "ars2", delta: "percent", frequency: "daily", note: "Créditos hipotecarios y plazos fijos UVA" },
      { key: "cer", source: bcra(30), label: "CER", unit: "index", delta: "percent", frequency: "daily", note: "Bonos ajustados por inflación" },
      { key: "icl", source: bcra(40), label: "ICL", unit: "index2", delta: "percent", frequency: "daily", note: "Contratos de alquiler" },
    ],
  },
];

/** `points` feed the card chart; `longPoints` feed the section comparison and correlations. */
const LOOKBACK: Record<Frequency, { days: number; points: number; longPoints: number }> = {
  daily: { days: 130, points: 30, longPoints: 90 },
  // 15 months: earlier data belongs to the 2024-25 disinflation regime.
  monthly: { days: 800, points: 13, longPoints: 15 },
};

export type MacroSeries = Series & { longHistory: Point[] };

export type MacroItem = Omit<MacroVariable, "source"> & { indicator: Indicator<MacroSeries> };

export type MacroGroup = { id: MacroGroupId; title: string; description: string; items: MacroItem[] };

export type RealRateData = {
  realPct: number;
  termDepositTea: number;
  expectedInflation: number;
  date: string;
};

export type MacroSnapshot = { groups: MacroGroup[]; realRate: Indicator<RealRateData> };

async function loadSource(source: MacroSource, days: number): Promise<Point[]> {
  if (source.kind === "bcra") return getBcraSeries(source.id, days, "daily");
  const [index] = await getIndecMonthlySeries([source.seriesId]);
  return changeOverMonths(index, source.change === "yoy" ? 12 : 1);
}

/** Loads every macro variable from its source; each one succeeds or fails on its own. */
export async function getMacroSnapshot(): Promise<MacroSnapshot> {
  "use cache";
  cacheLife(CACHE.daily);

  const groups = await Promise.all(
    GROUPS.map(async ({ variables, ...group }) => ({
      ...group,
      items: await Promise.all(
        variables.map(async ({ source, ...variable }) => {
          const { days, points, longPoints } = LOOKBACK[variable.frequency];
          const indicator = await settle<MacroSeries>(source.kind === "bcra" ? SOURCES.bcra : SOURCES.indec, async () => {
            const all = await loadSource(source, days);
            return { ...toSeries(all, points), longHistory: lastN(all, longPoints) };
          });
          return { ...variable, indicator };
        }),
      ),
    })),
  );

  const byKey = new Map(groups.flatMap((g) => g.items).map((item) => [item.key, item.indicator]));
  const realRateIndicator = await settle<RealRateData>(SOURCES.bcra, async () => {
    const termDeposit = byKey.get("termDeposit");
    const expected = byKey.get("expectedInflation");
    if (termDeposit?.status !== "ok" || expected?.status !== "ok") {
      throw new Error("Term deposit rate or expected inflation unavailable");
    }
    const termDepositTea = tnaToTea(termDeposit.data.value);
    return {
      realPct: realRate(termDepositTea, expected.data.value),
      termDepositTea,
      expectedInflation: expected.data.value,
      date: termDeposit.data.date,
    };
  });

  return { groups, realRate: realRateIndicator };
}
