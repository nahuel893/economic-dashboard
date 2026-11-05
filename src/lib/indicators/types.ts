export type Point = { date: string; value: number };

export type Quote = { buy: number; sell: number; updatedAt: string };

/**
 * Every indicator is fetched independently: one failing source must not take
 * down the whole dashboard, so each slot carries its own success or error.
 */
export type Indicator<T> =
  | { status: "ok"; source: string; data: T }
  | { status: "error"; source: string; message: string };

export type DollarKind = "oficial" | "blue" | "bolsa" | "contadoconliqui";

export type DollarData = {
  kind: DollarKind;
  label: string;
  quote: Quote;
  /** Sell price at the last close before the live quote's day. */
  previousClose: number | null;
  /** Last 30 points, for the card sparkline. */
  history: Point[];
  /** Longer window used by the section comparison chart and correlations. */
  longHistory: Point[];
};

export type GapData = { valuePct: number; ccl: number; official: number; history: Point[] };

export type BandData = {
  wholesale: number;
  lower: number;
  upper: number;
  positionPct: number;
  toCeilingPct: number;
  date: string;
  history: Point[];
  longHistory: Point[];
  lowerHistory: Point[];
  upperHistory: Point[];
};

export type CountryRiskData = { value: number; date: string; change: number | null; history: Point[] };

export type IndexData = {
  /** Trading day, or null when the source omits it. */
  date: string | null;
  name: string;
  value: number;
  previousClose: number;
  changePct: number;
  high: number;
  low: number;
};

export type MervalData = IndexData & { valueUsd: number | null };

export type CryptoDollarData = {
  quote: Quote;
  previousClose: number | null;
  history: Point[];
  longHistory: Point[];
};

export type HotSnapshot = {
  generatedAt: string;
  dollars: Indicator<DollarData>[];
  gap: Indicator<GapData>;
  band: Indicator<BandData>;
  countryRisk: Indicator<CountryRiskData>;
  merval: Indicator<MervalData>;
  cryptoDollar: Indicator<CryptoDollarData>;
};
