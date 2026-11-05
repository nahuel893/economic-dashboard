/**
 * The shape every Mapas source returns. Each KPI value variant is one
 * MapSeries: its periods in ascending order, each with the values of the
 * places it covers. Places are keyed by AreaId (provinces), RegionId or
 * aglomerado code, depending on the KPI (see geography.ts).
 */

export type MapValue = {
  value: number;
  /** Coefficient of variation in %, for survey estimates (EPH). */
  cv?: number;
};

export type MapPeriod = {
  /** Sortable key: "2026-06" (month), "2026-Q2" (quarter) or "2026-H1" (half-year). */
  period: string;
  values: Record<string, MapValue>;
  /** Caveat shown with this period, in Spanish (e.g. wages that include the aguinaldo). */
  note?: string;
};

export type MapSeries = { periods: MapPeriod[] };
