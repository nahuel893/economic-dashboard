"use client";

import { useId, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { SourceCitation } from "@/components/dashboard/source-citation";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatAxisValue, formatChange, formatDate, formatMonth, formatMonthShort, formatValue, type Unit } from "@/lib/format";
import { logTicks, periodTicks, type Granularity, type MonthRange } from "@/lib/indicators/history";
import { labelFits, spanAt, type AxisSpan, type MarkLayerKey } from "@/lib/indicators/marks";
import { videoFileName } from "@/lib/indicators/series-animation";
import type { Point } from "@/lib/indicators/types";
import type { VideoSeries } from "./series-video";
import { VideoExportButton } from "./video-export-button";

export type HistorySummary = {
  last: Point;
  min: Point;
  max: Point;
  /** % for levels, percentage points for rates; null with a single point. */
  change: number | null;
};

export type AxisLabels = "day" | "month" | "year";

/** A span of an active mark layer; `row` stacks the labels of different layers. */
export type ChartMark = AxisSpan & { layer: MarkLayerKey; row: number };

/** Height of one row of mark labels above the plot. */
const MARK_ROW = 14;

type LabelViewBox = { x?: number; y?: number; width?: number };

/** Draws a span's label centred above it, or nothing when the span is too narrow for it. */
function markLabel(text: string, row: number) {
  function MarkLabel({ viewBox }: { viewBox?: LabelViewBox }) {
    const { x = 0, y = 0, width = 0 } = viewBox ?? {};
    if (!labelFits(text, width)) return <g />;
    return (
      <text x={x + width / 2} y={y - 4 - row * MARK_ROW} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
        {text}
      </text>
    );
  }
  return MarkLabel;
}

type HistoryChartProps = {
  /** Stable name of the variable, used for the exported file. */
  variableKey: string;
  range: MonthRange;
  label: string;
  description: string;
  unit: Unit;
  frequency: "daily" | "monthly";
  granularity: Granularity;
  axis: AxisLabels;
  change: "percent" | "points";
  /** Whether the series may use a log axis at all (strictly positive levels). */
  logScale: boolean;
  points: Point[];
  marks: ChartMark[];
  summary: HistorySummary;
  source: string;
};

function formatTick(date: string, axis: AxisLabels): string {
  if (axis === "year") return date.slice(0, 4);
  if (axis === "month") return `${formatMonthShort(date).slice(0, 3)} ${date.slice(2, 4)}`;
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

const formatPointDate = (date: string, frequency: HistoryChartProps["frequency"]) =>
  frequency === "monthly" ? formatMonth(date) : formatDate(date);

const CLOSE_LABEL: Record<Granularity, string | null> = {
  daily: null,
  weekly: "Cierre de la semana del",
  monthly: "Cierre de",
};

export function HistoryChart(props: HistoryChartProps) {
  const { label, description, unit, frequency, granularity, axis, change, points, marks, summary, source } = props;
  const id = useId();
  const article = useRef<HTMLElement>(null);
  const canUseLog = props.logScale && points.every((p) => p.value > 0);
  // Linear by default; the log axis is opt-in per chart.
  const [log, setLog] = useState(false);
  const config = { value: { label, color: "var(--tone)" } } satisfies ChartConfig;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const ticks = log ? logTicks(min, max) : undefined;
  // Years and months are labelled once, where they start; days use the library's spacing.
  const xTicks = axis === "day" ? undefined : periodTicks(points.map((p) => p.date), axis, 8);
  const closeLabel = frequency === "daily" ? CLOSE_LABEL[granularity] : null;
  const markRows = marks.length ? Math.max(...marks.map((m) => m.row)) + 1 : 0;
  const layers = [...new Set(marks.map((m) => m.layer))];
  const pointDate = (date: string) =>
    granularity === "monthly" && frequency === "daily" ? formatMonth(date) : formatPointDate(date, frequency);

  /** The chart as it is now (window, scale and marks), with the page's colours and font. */
  const videoSeries = (): VideoSeries => {
    const style = getComputedStyle(article.current ?? document.body);
    const color = (name: string) => style.getPropertyValue(name).trim();
    return {
      title: label,
      description,
      periodLabel: `${formatMonth(points[0].date)} – ${formatMonth(points.at(-1)!.date)}`,
      source,
      site: window.location.host,
      points,
      marks,
      log,
      axis,
      colors: {
        background: color("--background"),
        card: color("--card"),
        foreground: color("--foreground"),
        muted: color("--muted-foreground"),
        border: color("--border"),
        tone: color("--tone"),
      },
      fontFamily: style.fontFamily,
      formatValue: (value) => formatValue(value, unit),
      formatAxis: (value) => formatAxisValue(value, unit),
      formatDate: pointDate,
      formatTick: (date) => formatTick(date, axis),
    };
  };

  return (
    <article
      ref={article}
      aria-labelledby={`${id}-title`}
      className="flex min-w-0 flex-col gap-3 rounded-lg border-t-[3px] border-t-tone bg-card p-4 ring-1 ring-foreground/10"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={`${id}-title`} className="text-sm font-semibold">
            {label}
          </h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-2xl font-bold tabular-nums">{formatValue(summary.last.value, unit)}</span>
          <span className="text-xs text-muted-foreground">{formatPointDate(summary.last.date, frequency)}</span>
        </div>
      </div>

      {points.length > 1 ? (
        <ChartContainer config={config} className="aspect-auto h-56 w-full min-w-0" initialDimension={{ width: 300, height: 224 }}>
          <LineChart data={points} margin={{ top: 8 + markRows * MARK_ROW, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            {marks.map((mark) => (
              <ReferenceArea
                key={`${mark.layer}-${mark.from}`}
                x1={mark.x1}
                x2={mark.x2}
                fill="var(--foreground)"
                fillOpacity={mark.shade ? 0.07 : 0.025}
                ifOverflow="hidden"
                label={markLabel(mark.label, mark.row)}
              />
            ))}
            {marks
              .filter((mark) => mark.edge)
              .map((mark) => (
                <ReferenceLine
                  key={`${mark.layer}-${mark.from}-edge`}
                  x={mark.x1}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.6}
                  strokeDasharray="3 3"
                />
              ))}
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              ticks={xTicks}
              interval={xTicks ? 0 : "preserveEnd"}
              tick={{ fontSize: 11 }}
              tickFormatter={(d: string) => formatTick(d, axis)}
            />
            <YAxis
              width={76}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              scale={log ? "log" : "auto"}
              domain={log ? [min, max] : ["auto", "auto"]}
              ticks={ticks}
              allowDataOverflow={log}
              tickFormatter={(v: number) => formatAxisValue(v, unit)}
            />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as Point | undefined;
                if (!active || !point) return null;
                return (
                  <div className="flex flex-col gap-0.5 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
                    <span className="text-muted-foreground">
                      {closeLabel ? `${closeLabel} ` : ""}
                      {pointDate(point.date)}
                    </span>
                    <span className="font-medium">{formatValue(point.value, unit)}</span>
                    {layers.map((layer) => {
                      const span = spanAt(marks.filter((m) => m.layer === layer), point.date);
                      return span ? (
                        <span key={layer} className="text-muted-foreground">
                          {span.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                );
              }}
            />
            <Line type="linear" dataKey="value" stroke="var(--tone)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">No hay datos en este período.</p>
      )}

      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Variación</dt>
          <dd className="font-medium tabular-nums">{summary.change === null ? "—" : formatChange(summary.change, change)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Mínimo</dt>
          <dd className="font-medium tabular-nums" title={formatPointDate(summary.min.date, frequency)}>
            {formatValue(summary.min.value, unit)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Máximo</dt>
          <dd className="font-medium tabular-nums" title={formatPointDate(summary.max.date, frequency)}>
            {formatValue(summary.max.value, unit)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          Fuente: <SourceCitation source={source} />
          {closeLabel ? `. ${granularity === "weekly" ? "Cierres semanales" : "Cierres mensuales"}.` : "."}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {canUseLog ? (
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                className="size-3.5 cursor-pointer accent-[var(--tone)] focus-visible:outline-2 focus-visible:outline-ring"
                checked={log}
                onChange={(e) => setLog(e.target.checked)}
              />
              Escala logarítmica
            </label>
          ) : null}
          {points.length > 1 ? (
            <VideoExportButton
              getSeries={videoSeries}
              fileName={(extension) => videoFileName(props.variableKey, props.range, extension)}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}
