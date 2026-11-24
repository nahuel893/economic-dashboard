import type { CSSProperties } from "react";
import { Section } from "@/components/dashboard/section";
import { toneVar, VARIABLE_TONES, type Tone } from "@/components/dashboard/tones";
import { UnavailableTile } from "@/components/dashboard/stat-tile";
import type { HistoryGroupId, HistorySnapshot, HistoryVariable } from "@/lib/indicators/history-data";
import { downsample, granularityFor, inRange, periodChange, type MonthRange } from "@/lib/indicators/history";
import { MARK_LAYERS, spansOnAxis, type MarkLayerKey } from "@/lib/indicators/marks";
import type { Point } from "@/lib/indicators/types";
import { axisLabelsFor } from "@/lib/indicators/zoom";
import { HistoryChart, type ChartMark, type HistoryChartProps, type HistorySummary } from "./history-chart";
import { VariantChart } from "./variant-chart";

const GROUP_TONES: Record<HistoryGroupId, Tone> = {
  dollars: "dollars",
  inflation: "inflation",
  // Same amber as on the main dashboard; see the note on its section tones.
  activity: "pressure",
  markets: "risk",
};


function summarize(points: Point[], change: HistoryVariable["change"]): HistorySummary | null {
  if (!points.length) return null;
  const min = points.reduce((a, b) => (b.value < a.value ? b : a));
  const max = points.reduce((a, b) => (b.value > a.value ? b : a));
  return { last: points.at(-1)!, min, max, change: periodChange(points, change) };
}

/** The spans of every active layer, placed on this chart's dates; each layer labels its own row. */
function chartMarks(marks: MarkLayerKey[], points: Point[]): ChartMark[] {
  const dates = points.map((p) => p.date);
  return MARK_LAYERS.filter((layer) => marks.includes(layer.key)).flatMap((layer, row) =>
    spansOnAxis(layer.spans, dates).map((span) => ({ ...span, layer: layer.key, row })),
  );
}

/** The chart of one series of a variable over the range, or null when the range holds none of its data. */
function chartFor(
  variable: HistoryVariable,
  series: Pick<HistoryVariable, "key" | "description"> & { data: Point[]; source: string },
  range: MonthRange,
  marks: MarkLayerKey[],
): HistoryChartProps | null {
  const points = inRange(series.data, range);
  const summary = summarize(points, variable.change);
  if (!summary) return null;
  const granularity = granularityFor(range);
  const chartPoints = downsample(points, granularity);
  return {
    variableKey: series.key,
    range,
    label: variable.label,
    description: series.description,
    unit: variable.unit,
    frequency: variable.frequency,
    granularity,
    axis: axisLabelsFor(range.from, range.to),
    change: variable.change,
    logScale: variable.logScale,
    points: chartPoints,
    marks: chartMarks(marks, chartPoints),
    summary,
    source: series.source,
  };
}

type VariableChartProps = { variable: HistoryVariable; range: MonthRange; marks: MarkLayerKey[] };

function VariableChart({ variable, range, marks }: VariableChartProps) {
  const { indicator } = variable;
  // A variable may wear another tone than its group, e.g. reserves in the "markets" group.
  const tone = VARIABLE_TONES[variable.key];
  const style = tone ? ({ "--tone": toneVar(tone) } as CSSProperties) : undefined;

  if (indicator.status === "error") {
    return (
      <div style={style}>
        <UnavailableTile label={variable.label} source={indicator.source} message={indicator.message} />
      </div>
    );
  }

  const chart = chartFor(variable, { ...variable, ...indicator }, range, marks);
  if (!chart) {
    return (
      <div style={style} className="flex flex-col gap-1 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
        <h3 className="text-sm font-semibold">{variable.label}</h3>
        <p className="text-sm text-muted-foreground">Sin datos en el período elegido.</p>
      </div>
    );
  }

  // Variants that failed or have no data in the range are left out of the toggle.
  const options = (variable.variants ?? []).flatMap((variant) => {
    if (variant.indicator.status !== "ok") return [];
    const variantChart = chartFor(variable, { ...variant, ...variant.indicator }, range, marks);
    return variantChart ? [{ key: variant.key, option: variant.option, chart: variantChart }] : [];
  });

  return (
    <div style={style} className="min-w-0">
      {options.length > 1 ? <VariantChart options={options} initial={variable.key} /> : <HistoryChart {...chart} />}
    </div>
  );
}

type HistorySectionsProps = { snapshot: HistorySnapshot; range: MonthRange; marks: MarkLayerKey[] };

export function HistorySections({ snapshot, range, marks }: HistorySectionsProps) {
  return snapshot.groups.map((group) => (
    <Section key={group.id} id={`history-${group.id}`} title={group.title} description={group.description} tone={GROUP_TONES[group.id]}>
      <div className="grid gap-4 lg:grid-cols-2">
        {group.variables.map((variable) => (
          <VariableChart key={variable.key} variable={variable} range={range} marks={marks} />
        ))}
      </div>
    </Section>
  ));
}
