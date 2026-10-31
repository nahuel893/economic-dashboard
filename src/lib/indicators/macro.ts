import { cacheLife } from "next/cache";
import type { Unit } from "@/lib/format";
import { CACHE, SOURCES, getBcraSeries } from "@/lib/sources/clients";
import { realRate, tnaToTea, toSeries, type Series } from "./calc";
import { settle } from "./settle";
import type { Indicator } from "./types";

/** How a change is shown: relative change in percent, or absolute change in percentage points. */
export type DeltaMode = "percent" | "points";
export type Frequency = "daily" | "monthly";

type MacroVariable = {
  key: string;
  /** Variable id in BCRA Estadísticas v4 ("Principales Variables"). */
  bcraId: number;
  label: string;
  unit: Unit;
  delta: DeltaMode;
  frequency: Frequency;
  note?: string;
  /** Monthly columns with a value label on each bar, instead of a sparkline. */
  chart?: "columns";
};

export type MacroGroupId = "money" | "inflation" | "rates" | "indexes";

const GROUPS: { id: MacroGroupId; title: string; description: string; variables: MacroVariable[] }[] = [
  {
    id: "money",
    title: "Reservas y dinero",
    description: "Dólares del BCRA y pesos que circulan en la economía.",
    variables: [
      { key: "reserves", bcraId: 1, label: "Reservas internacionales", unit: "usdMillions", delta: "percent", frequency: "daily" },
      { key: "monetaryBase", bcraId: 15, label: "Base monetaria", unit: "arsMillions", delta: "percent", frequency: "daily" },
      { key: "m2", bcraId: 25, label: "M2 privado, variación interanual", unit: "percent", delta: "points", frequency: "daily", note: "Promedio móvil de 30 días" },
      { key: "deposits", bcraId: 21, label: "Depósitos totales", unit: "arsMillions", delta: "percent", frequency: "daily" },
      { key: "timeDeposits", bcraId: 24, label: "Depósitos a plazo", unit: "arsMillions", delta: "percent", frequency: "daily" },
      { key: "privateLoans", bcraId: 26, label: "Préstamos al sector privado", unit: "arsMillions", delta: "percent", frequency: "daily" },
    ],
  },
  {
    id: "inflation",
    title: "Inflación",
    description: "Dato del INDEC informado por el BCRA y lo que espera el mercado.",
    variables: [
      { key: "monthlyInflation", bcraId: 27, label: "Inflación mensual", unit: "percent", delta: "points", frequency: "monthly", chart: "columns" },
      { key: "yearlyInflation", bcraId: 28, label: "Inflación interanual", unit: "percent", delta: "points", frequency: "monthly", chart: "columns" },
      { key: "expectedInflation", bcraId: 29, label: "Inflación esperada a 12 meses", unit: "percent", delta: "points", frequency: "monthly", note: "Mediana del REM", chart: "columns" },
    ],
  },
  {
    id: "rates",
    title: "Tasas de interés",
    description: "Tasas nominales anuales (TNA) en pesos.",
    variables: [
      { key: "termDeposit", bcraId: 12, label: "Plazo fijo a 30 días", unit: "percent", delta: "points", frequency: "daily" },
      { key: "tamar", bcraId: 44, label: "TAMAR bancos privados", unit: "percent", delta: "points", frequency: "daily" },
      { key: "badlar", bcraId: 7, label: "BADLAR bancos privados", unit: "percent", delta: "points", frequency: "daily" },
      { key: "personalLoans", bcraId: 14, label: "Préstamos personales", unit: "percent", delta: "points", frequency: "daily" },
      { key: "overdraft", bcraId: 13, label: "Adelantos en cuenta corriente", unit: "percent", delta: "points", frequency: "daily" },
    ],
  },
  {
    id: "indexes",
    title: "Índices de ajuste",
    description: "Unidades que actualizan créditos, bonos y alquileres.",
    variables: [
      { key: "uva", bcraId: 31, label: "UVA", unit: "ars2", delta: "percent", frequency: "daily", note: "Créditos hipotecarios y plazos fijos UVA" },
      { key: "cer", bcraId: 30, label: "CER", unit: "index", delta: "percent", frequency: "daily", note: "Bonos ajustados por inflación" },
      { key: "icl", bcraId: 40, label: "ICL", unit: "index2", delta: "percent", frequency: "daily", note: "Contratos de alquiler" },
    ],
  },
];

const LOOKBACK: Record<Frequency, { days: number; points: number }> = {
  daily: { days: 45, points: 30 },
  monthly: { days: 400, points: 13 },
};

export type MacroItem = Omit<MacroVariable, "bcraId"> & { indicator: Indicator<Series> };

export type MacroGroup = { id: MacroGroupId; title: string; description: string; items: MacroItem[] };

export type RealRateData = {
  realPct: number;
  termDepositTea: number;
  expectedInflation: number;
  date: string;
};

export type MacroSnapshot = { groups: MacroGroup[]; realRate: Indicator<RealRateData> };

/** Loads every macro variable from the BCRA; each one succeeds or fails on its own. */
export async function getMacroSnapshot(): Promise<MacroSnapshot> {
  "use cache";
  cacheLife(CACHE.daily);

  const groups = await Promise.all(
    GROUPS.map(async ({ variables, ...group }) => ({
      ...group,
      items: await Promise.all(
        variables.map(async ({ bcraId, ...variable }) => {
          const { days, points } = LOOKBACK[variable.frequency];
          const indicator = await settle(SOURCES.bcra, async () =>
            toSeries(await getBcraSeries(bcraId, days, "daily"), points),
          );
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
