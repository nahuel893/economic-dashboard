import { ColumnChart } from "@/components/dashboard/column-chart";
import { Section, type Tone } from "@/components/dashboard/section";
import { Sparkline } from "@/components/dashboard/sparkline";
import { StatTile, UnavailableTile, type Delta } from "@/components/dashboard/stat-tile";
import { formatDate, formatMonth, formatNumber, formatPercent, formatSignedPercent, formatValue } from "@/lib/format";
import { percentGap, type Series } from "@/lib/indicators/calc";
import type { MacroGroup, MacroGroupId, MacroItem, MacroSnapshot, RealRateData } from "@/lib/indicators/macro";
import type { Indicator } from "@/lib/indicators/types";

const TONES: Record<MacroGroupId, Tone> = {
  money: "money",
  inflation: "inflation",
  rates: "rates",
  indexes: "indexes",
};

const GRID: Record<MacroGroupId, string> = {
  money: "sm:grid-cols-2 lg:grid-cols-3",
  inflation: "md:grid-cols-3",
  rates: "sm:grid-cols-2 lg:grid-cols-3",
  indexes: "md:grid-cols-3",
};

function seriesDelta(series: Series, item: MacroItem): Delta | null {
  if (series.previous === null) return null;
  const label = item.frequency === "monthly" ? "vs. mes anterior" : "vs. dato anterior";
  if (item.delta === "points") {
    const diff = Math.round((series.value - series.previous) * 100) / 100;
    const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
    return { value: diff, text: `${sign}${formatNumber(Math.abs(diff), 2)} pp`, label };
  }
  const change = Math.round(percentGap(series.value, series.previous) * 100) / 100;
  return { value: change, text: formatSignedPercent(change, 2), label };
}

function MacroTile({ item }: { item: MacroItem }) {
  const { indicator } = item;
  if (indicator.status === "error") {
    return <UnavailableTile label={item.label} source={indicator.source} message={indicator.message} />;
  }
  const series = indicator.data;
  const monthly = item.frequency === "monthly";
  return (
    <StatTile
      size="md"
      label={item.label}
      value={formatValue(series.value, item.unit)}
      delta={seriesDelta(series, item)}
      secondary={item.note}
      badge={monthly ? "Mensual" : undefined}
      source={indicator.source}
      asOf={monthly ? `Dato de ${formatMonth(series.date)}` : `Dato del ${formatDate(series.date)}`}
    >
      {item.chart === "columns" ? (
        <ColumnChart points={series.history} unit={item.unit} label={`${item.label}, últimos ${series.history.length} meses`} />
      ) : (
        <Sparkline
          points={series.history}
          unit={item.unit}
          label={`${item.label}, últimos ${series.history.length} ${monthly ? "meses" : "datos"}`}
        />
      )}
    </StatTile>
  );
}

function RealRateTile({ indicator }: { indicator: Indicator<RealRateData> }) {
  if (indicator.status === "error") {
    return <UnavailableTile label="Tasa real esperada" source={indicator.source} message={indicator.message} />;
  }
  const { realPct, termDepositTea, expectedInflation, date } = indicator.data;
  return (
    <StatTile
      size="md"
      label="Tasa real esperada del plazo fijo"
      value={formatPercent(realPct)}
      badge="Cálculo propio"
      secondary={
        <>
          <span className="block font-medium text-foreground">
            {realPct >= 0 ? "Le gana a la inflación esperada" : "Pierde contra la inflación esperada"}
          </span>
          Plazo fijo a 30 días renovado un año (TEA {formatPercent(termDepositTea)}) contra la inflación esperada
          por el REM ({formatPercent(expectedInflation)}).
        </>
      }
      source={indicator.source}
      asOf={`Tasa del ${formatDate(date)}`}
    />
  );
}

function MacroSection({ group, realRate }: { group: MacroGroup; realRate?: Indicator<RealRateData> }) {
  return (
    <Section id={group.id} title={group.title} description={group.description} tone={TONES[group.id]}>
      <div className={`grid gap-4 ${GRID[group.id]}`}>
        {realRate ? <RealRateTile indicator={realRate} /> : null}
        {group.items.map((item) => (
          <MacroTile key={item.key} item={item} />
        ))}
      </div>
    </Section>
  );
}

/** Renders one macro group by id; the page decides the order of sections. */
export function MacroGroupSection({ snapshot, id }: { snapshot: MacroSnapshot; id: MacroGroupId }) {
  const group = snapshot.groups.find((g) => g.id === id);
  if (!group) return null;
  return <MacroSection group={group} realRate={id === "rates" ? snapshot.realRate : undefined} />;
}
