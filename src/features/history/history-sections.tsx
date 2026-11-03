import type { CSSProperties } from "react";
import { Section, type Tone } from "@/components/dashboard/section";
import { UnavailableTile } from "@/components/dashboard/stat-tile";
import type { HistoryGroupId, HistorySnapshot, HistoryVariable } from "@/lib/indicators/history-data";
import { downsample, granularityFor, inRange, monthsIn, periodChange, type MonthRange } from "@/lib/indicators/history";
import type { Point } from "@/lib/indicators/types";
import { HistoryChart, type AxisLabels, type HistorySummary } from "./history-chart";

const GROUP_TONES: Record<HistoryGroupId, Tone> = { dollars: "dollars", inflation: "inflation", markets: "risk" };

/** Variables that read better in the tone of their topic on the main dashboard. */
const VARIABLE_TONES: Partial<Record<string, Tone>> = { gap: "pressure", reserves: "money", badlar: "rates" };

function summarize(points: Point[], change: HistoryVariable["change"]): HistorySummary | null {
  if (!points.length) return null;
  const min = points.reduce((a, b) => (b.value < a.value ? b : a));
  const max = points.reduce((a, b) => (b.value > a.value ? b : a));
  return { last: points.at(-1)!, min, max, change: periodChange(points, change) };
}

function axisFor(range: MonthRange): AxisLabels {
  const months = monthsIn(range);
  return months <= 6 ? "day" : months <= 36 ? "month" : "year";
}

function VariableChart({ variable, range }: { variable: HistoryVariable; range: MonthRange }) {
  const { indicator } = variable;
  const tone = VARIABLE_TONES[variable.key];
  const style = tone ? ({ "--tone": `var(--tone-${tone})` } as CSSProperties) : undefined;

  if (indicator.status === "error") {
    return (
      <div style={style}>
        <UnavailableTile label={variable.label} source={indicator.source} message={indicator.message} />
      </div>
    );
  }

  const points = inRange(indicator.data, range);
  const summary = summarize(points, variable.change);
  if (!summary) {
    return (
      <div style={style} className="flex flex-col gap-1 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
        <h3 className="text-sm font-semibold">{variable.label}</h3>
        <p className="text-sm text-muted-foreground">Sin datos en el período elegido.</p>
      </div>
    );
  }

  const granularity = granularityFor(range);
  return (
    <div style={style} className="min-w-0">
      <HistoryChart
        // A new range resets the log toggle to what suits that window.
        key={`${range.from}-${range.to}`}
        label={variable.label}
        description={variable.description}
        unit={variable.unit}
        frequency={variable.frequency}
        granularity={granularity}
        axis={axisFor(range)}
        change={variable.change}
        logScale={variable.logScale}
        points={downsample(points, granularity)}
        summary={summary}
        source={indicator.source}
      />
    </div>
  );
}

export function HistorySections({ snapshot, range }: { snapshot: HistorySnapshot; range: MonthRange }) {
  return snapshot.groups.map((group) => (
    <Section key={group.id} id={`history-${group.id}`} title={group.title} description={group.description} tone={GROUP_TONES[group.id]}>
      <div className="grid gap-4 lg:grid-cols-2">
        {group.variables.map((variable) => (
          <VariableChart key={variable.key} variable={variable} range={range} />
        ))}
      </div>
    </Section>
  ));
}
