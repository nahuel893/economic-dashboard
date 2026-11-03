import { cacheLife } from "next/cache";
import {
  BCRA_VARIABLES,
  CACHE,
  SOURCES,
  getBcraSeries,
  getBymaIndex,
  getCountryRiskHistory,
  getDollarHistory,
  getLiveDollarQuotes,
} from "@/lib/sources/clients";
import { settle } from "./settle";
import { bandPosition, gapHistory, lastN, percentGap, toBuenosAiresDate, valueBefore } from "./calc";
import type {
  BandData,
  CountryRiskData,
  CryptoDollarData,
  DollarData,
  DollarKind,
  GapData,
  HotSnapshot,
  MervalData,
  Point,
  Quote,
} from "./types";

const HISTORY_POINTS = 30;
/** Points used by the comparison charts and correlations (~4 months of business days). */
const LONG_POINTS = 90;
const BCRA_LOOKBACK_DAYS = 130;
const MERVAL_SYMBOL = "MMSCI";

const DOLLARS: { kind: DollarKind; label: string }[] = [
  { kind: "oficial", label: "Oficial" },
  { kind: "blue", label: "Blue" },
  { kind: "bolsa", label: "MEP" },
  { kind: "contadoconliqui", label: "CCL" },
];

function requireQuote(quotes: Record<string, Quote>, kind: string): Quote {
  const quote = quotes[kind];
  if (!quote) throw new Error(`dolarapi.com has no "${kind}" quote`);
  return quote;
}

function previousClose(points: Point[], quote: Quote): number | null {
  return valueBefore(points, toBuenosAiresDate(quote.updatedAt));
}

/** Loads every hot indicator; each one succeeds or fails on its own. */
export async function getHotSnapshot(): Promise<HotSnapshot> {
  "use cache";
  cacheLife(CACHE.live);

  // Shared inputs are started once and reused by every indicator that needs them.
  const live = getLiveDollarQuotes();
  const history = (kind: string) => getDollarHistory(kind).then((points) => lastN(points, LONG_POINTS));
  const officialHistory = history("oficial");
  const cclHistory = history("contadoconliqui");
  // Avoid unhandled rejections for promises only consumed inside `settle`.
  [live, officialHistory, cclHistory].forEach((p) => p.catch(() => undefined));

  const [dollars, gap, band, countryRisk, merval, cryptoDollar] = await Promise.all([
    Promise.all(
      DOLLARS.map(({ kind, label }) =>
        settle<DollarData>(SOURCES.dollars, async () => {
          const quote = requireQuote(await live, kind);
          const points = await (kind === "oficial"
            ? officialHistory
            : kind === "contadoconliqui"
              ? cclHistory
              : history(kind));
          return {
            kind,
            label,
            quote,
            previousClose: previousClose(points, quote),
            history: lastN(points, HISTORY_POINTS),
            longHistory: points,
          };
        }),
      ),
    ),
    settle<GapData>(SOURCES.dollars, async () => {
      const quotes = await live;
      const ccl = requireQuote(quotes, "contadoconliqui").sell;
      const official = requireQuote(quotes, "oficial").sell;
      return {
        valuePct: percentGap(ccl, official),
        ccl,
        official,
        history: lastN(gapHistory(await cclHistory, await officialHistory), HISTORY_POINTS),
      };
    }),
    settle<BandData>(SOURCES.bcra, async () => {
      const [wholesale, lower, upper] = await Promise.all([
        getBcraSeries(BCRA_VARIABLES.wholesaleDollar, BCRA_LOOKBACK_DAYS, "live"),
        getBcraSeries(BCRA_VARIABLES.bandLower, BCRA_LOOKBACK_DAYS, "live"),
        getBcraSeries(BCRA_VARIABLES.bandUpper, BCRA_LOOKBACK_DAYS, "live"),
      ]);
      const latest = wholesale.at(-1)!;
      const lowerValue = lower.at(-1)!.value;
      const upperValue = upper.at(-1)!.value;
      return {
        wholesale: latest.value,
        lower: lowerValue,
        upper: upperValue,
        date: latest.date,
        ...bandPosition(latest.value, lowerValue, upperValue),
        history: lastN(wholesale, HISTORY_POINTS),
        longHistory: lastN(wholesale, LONG_POINTS),
        lowerHistory: lastN(lower, LONG_POINTS),
        upperHistory: lastN(upper, LONG_POINTS),
      };
    }),
    settle<CountryRiskData>(SOURCES.argentinaDatos, async () => {
      const points = lastN(await getCountryRiskHistory(), HISTORY_POINTS);
      const latest = points.at(-1);
      if (!latest) throw new Error("Country risk series is empty");
      const previous: Point | undefined = points.at(-2);
      return {
        value: latest.value,
        date: latest.date,
        change: previous ? latest.value - previous.value : null,
        history: points,
      };
    }),
    settle<MervalData>(SOURCES.byma, async () => {
      const index = await getBymaIndex(MERVAL_SYMBOL);
      const ccl = await live.then((q) => q.contadoconliqui?.sell ?? null).catch(() => null);
      return { ...index, valueUsd: ccl ? index.value / ccl : null };
    }),
    settle<CryptoDollarData>(SOURCES.dollars, async () => {
      const quote = requireQuote(await live, "cripto");
      const points = await history("cripto");
      return {
        quote,
        previousClose: previousClose(points, quote),
        history: lastN(points, HISTORY_POINTS),
        longHistory: points,
      };
    }),
  ]);

  return { generatedAt: new Date().toISOString(), dollars, gap, band, countryRisk, merval, cryptoDollar };
}
