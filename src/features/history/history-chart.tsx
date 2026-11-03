"use client";

import { useId, useState } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatArs, formatDate, formatMonth, formatMonthShort, formatNumber, formatSignedPercent, formatValue, type Unit } from "@/lib/format";
import { logTicks, periodTicks, spansOrdersOfMagnitude, type Granularity } from "@/lib/indicators/history";
import type { Point } from "@/lib/indicators/types";

export type HistorySummary = {
  last: Point;
  min: Point;
  max: Point;
  /** % for levels, percentage points for rates; null with a single point. */
  change: number | null;
};

export type AxisLabels = "day" | "month" | "year";

type HistoryChartProps = {
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
  summary: HistorySummary;
  source: string;
};

function formatTick(date: string, axis: AxisLabels): string {
  if (axis === "year") return date.slice(0, 4);
  if (axis === "month") return `${formatMonthShort(date).slice(0, 3)} ${date.slice(2, 4)}`;
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** Shorter values for the axis: no cents unless the prices are small, and no currency on millions (the description says it). */
function formatAxisValue(value: number, unit: Unit): string {
  if (unit === "usdMillions") return formatNumber(value);
  const small = value !== 0 && Math.abs(value) < 10;
  if (unit === "ars2") return formatArs(value, small ? 1 : 0);
  if (unit === "percent") return `${formatNumber(value, small ? 1 : 0)} %`;
  return formatValue(value, unit);
}

const formatChange = (value: number, kind: HistoryChartProps["change"]) =>
  kind === "percent"
    ? formatSignedPercent(value, 1)
    : `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatNumber(Math.abs(value), 1)} pp`;

const formatPointDate = (date: string, frequency: HistoryChartProps["frequency"]) =>
  frequency === "monthly" ? formatMonth(date) : formatDate(date);

const CLOSE_LABEL: Record<Granularity, string | null> = {
  daily: null,
  weekly: "Cierre de la semana del",
  monthly: "Cierre de",
};

export function HistoryChart(props: HistoryChartProps) {
  const { label, description, unit, frequency, granularity, axis, change, points, summary, source } = props;
  const id = useId();
  const canUseLog = props.logScale && points.every((p) => p.value > 0);
  // Log by default only when a linear axis would flatten the early part of the window.
  const [log, setLog] = useState(() => canUseLog && spansOrdersOfMagnitude(points));
  const config = { value: { label, color: "var(--tone)" } } satisfies ChartConfig;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const ticks = log ? logTicks(min, max) : undefined;
  // Years and months are labelled once, where they start; days use the library's spacing.
  const xTicks = axis === "day" ? undefined : periodTicks(points.map((p) => p.date), axis, 8);
  const closeLabel = frequency === "daily" ? CLOSE_LABEL[granularity] : null;

  return (
    <article
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
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
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
                      {granularity === "monthly" && frequency === "daily" ? formatMonth(point.date) : formatPointDate(point.date, frequency)}
                    </span>
                    <span className="font-medium">{formatValue(point.value, unit)}</span>
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
          Fuente: {source}
          {closeLabel ? `. ${granularity === "weekly" ? "Cierres semanales" : "Cierres mensuales"}.` : "."}
        </span>
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
      </div>
    </article>
  );
}
