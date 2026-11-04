import { cacheLife } from "next/cache";
import type { Unit } from "@/lib/format";
import {
  CACHE,
  BCRA_VARIABLES,
  getBcraHistory,
  getCountryRiskHistory,
  getDollarHistory,
  getIndecMonthlySeries,
  getMonthlyIndexHistory,
  INDEC_SERIES,
  SOURCES,
} from "@/lib/sources/clients";
import { changeOverMonths, gapHistory } from "./calc";
import { HISTORY_FLOOR } from "./history";
import { settle } from "./settle";
import type { Indicator, Point } from "./types";

export type HistoryGroupId = "dollars" | "inflation" | "activity" | "markets";

export type HistoryVariable = {
  key: string;
  label: string;
  description: string;
  unit: Unit;
  frequency: "daily" | "monthly";
  /** How the change over the selected period is expressed. */
  change: "percent" | "points";
  /** Strictly positive levels that may span orders of magnitude, where a log axis helps. */
  logScale: boolean;
  indicator: Indicator<Point[]>;
};

export type HistoryGroup = { id: HistoryGroupId; title: string; description: string; variables: HistoryVariable[] };

export type HistorySnapshot = {
  groups: HistoryGroup[];
  /** Latest month with data in any series (YYYY-MM): the end of the default range. */
  latestMonth: string;
};

const BCRA_FROM = `${HISTORY_FLOOR}-01`;

const fromFloor = (points: Point[]) =>
  points.filter((p) => p.date >= BCRA_FROM).sort((a, b) => a.date.localeCompare(b.date));

const dollar = (kind: string) => () => getDollarHistory(kind).then(fromFloor);

export async function getHistorySnapshot(): Promise<HistorySnapshot> {
  "use cache";
  cacheLife(CACHE.daily);

  // One request for both EMAE series, shared by the two activity charts.
  const emae = getIndecMonthlySeries([INDEC_SERIES.emae, INDEC_SERIES.emaeSeasonallyAdjusted]);
  emae.catch(() => undefined);

  const [blue, official, mep, ccl, gap, monthly, yearly, activity, activityYearly, risk, reserves, badlar] = await Promise.all([
    settle(SOURCES.argentinaDatos, dollar("blue")),
    settle(SOURCES.argentinaDatos, dollar("oficial")),
    settle(SOURCES.argentinaDatos, dollar("bolsa")),
    settle(SOURCES.argentinaDatos, dollar("contadoconliqui")),
    settle(SOURCES.argentinaDatos, async () =>
      gapHistory(await getDollarHistory("contadoconliqui").then(fromFloor), await getDollarHistory("oficial")),
    ),
    settle(SOURCES.argentinaDatos, () => getMonthlyIndexHistory("inflacion").then(fromFloor)),
    settle(SOURCES.argentinaDatos, () => getMonthlyIndexHistory("inflacionInteranual").then(fromFloor)),
    settle(SOURCES.indec, async () => fromFloor((await emae)[1])),
    // Computed on the whole series, so the first year after the floor has its comparison month.
    settle(SOURCES.indec, async () => fromFloor(changeOverMonths((await emae)[0], 12))),
    settle(SOURCES.argentinaDatos, () => getCountryRiskHistory().then(fromFloor)),
    settle(SOURCES.bcra, () => getBcraHistory(BCRA_VARIABLES.reserves, BCRA_FROM)),
    settle(SOURCES.bcra, () => getBcraHistory(BCRA_VARIABLES.badlar, BCRA_FROM)),
  ]);

  const level = (key: string, label: string, description: string, indicator: Indicator<Point[]>): HistoryVariable => ({
    key,
    label,
    description,
    unit: "ars2",
    frequency: "daily",
    change: "percent",
    logScale: true,
    indicator,
  });

  const groups: HistoryGroup[] = [
    {
      id: "dollars",
      title: "Dólar",
      description: "Precio de venta en pesos, valores nominales.",
      variables: [
        level("blue", "Dólar blue", "Mercado informal.", blue),
        level("oficial", "Dólar oficial", "Promedio de bancos.", official),
        level("mep", "Dólar MEP", "Compra y venta de bonos en pesos y en dólares.", mep),
        level("ccl", "Dólar CCL", "Contado con liquidación: bonos o acciones liquidados en el exterior.", ccl),
        {
          key: "gap",
          label: "Brecha CCL vs. oficial",
          description: "Cuánto más caro está el CCL que el oficial.",
          unit: "percent",
          frequency: "daily",
          change: "points",
          logScale: false,
          indicator: gap,
        },
      ],
    },
    {
      id: "inflation",
      title: "Inflación",
      description: "Variación del índice de precios al consumidor del INDEC.",
      variables: [
        {
          key: "monthlyInflation",
          label: "Inflación mensual",
          description: "Variación contra el mes anterior.",
          unit: "percent",
          frequency: "monthly",
          change: "points",
          logScale: false,
          indicator: monthly,
        },
        {
          key: "yearlyInflation",
          label: "Inflación interanual",
          description: "Variación contra el mismo mes del año anterior.",
          unit: "percent",
          frequency: "monthly",
          change: "points",
          logScale: false,
          indicator: yearly,
        },
      ],
    },
    {
      id: "activity",
      title: "Actividad económica",
      description: "El PBI mes a mes: Estimador Mensual de Actividad Económica (EMAE) del INDEC.",
      variables: [
        {
          key: "activity",
          label: "Nivel de actividad",
          description: "Índice desestacionalizado, base 2004 = 100: si la economía produce más o menos.",
          unit: "index2",
          frequency: "monthly",
          change: "percent",
          logScale: false,
          indicator: activity,
        },
        {
          key: "activityYearly",
          label: "Actividad, variación interanual",
          description: "Contra el mismo mes del año anterior, con la serie original.",
          unit: "percent",
          frequency: "monthly",
          change: "points",
          logScale: false,
          indicator: activityYearly,
        },
      ],
    },
    {
      id: "markets",
      title: "Riesgo, reservas y tasas",
      description: "Indicadores financieros con historia larga.",
      variables: [
        {
          key: "countryRisk",
          label: "Riesgo país",
          description: "EMBI de JP Morgan: sobretasa de los bonos argentinos sobre los del Tesoro de EE.UU.",
          unit: "bps",
          frequency: "daily",
          change: "percent",
          logScale: true,
          indicator: risk,
        },
        {
          key: "reserves",
          label: "Reservas internacionales",
          description: "Reservas brutas del BCRA, en millones de dólares.",
          unit: "usdMillions",
          frequency: "daily",
          change: "percent",
          logScale: false,
          indicator: reserves,
        },
        {
          key: "badlar",
          label: "Tasa BADLAR",
          description: "Tasa nominal anual por depósitos a plazo de más de $ 1 millón en bancos privados.",
          unit: "percent",
          frequency: "daily",
          change: "points",
          logScale: false,
          indicator: badlar,
        },
      ],
    },
  ];

  const lastDates = groups.flatMap((g) =>
    g.variables.flatMap((v) => (v.indicator.status === "ok" && v.indicator.data.length ? [v.indicator.data.at(-1)!.date] : [])),
  );
  const latestMonth = lastDates.reduce((max, d) => (d > max ? d : max), BCRA_FROM).slice(0, 7);

  return { groups, latestMonth };
}
