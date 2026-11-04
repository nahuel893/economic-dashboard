"use client";

import { useId, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { SourceCitation } from "@/components/dashboard/source-citation";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatAxisValue, formatMonth, formatMonthShort, formatNumber, formatValue, type Unit } from "@/lib/format";
import { linearTicks, periodTicks } from "@/lib/indicators/history";
import type { MonthRow } from "@/lib/indicators/panel";
import { cn } from "@/lib/utils";

/** Every chart of the panel shares this id: hovering a month on one shows it on all. */
const SYNC_ID = "panel";

export type ChartSeries = { key: string; label: string; color: string; available: boolean };

type PanelChartProps = {
  title: string;
  description: string;
  kind: "line" | "bar";
  unit: Unit;
  series: ChartSeries[];
  rows: MonthRow[];
  source: string;
  size: "sm" | "lg";
  /** Value shown in the header, e.g. the latest close. */
  headline?: ReactNode;
  className?: string;
};

/** Months are plain YYYY-MM keys; mid-month avoids any time zone shift. */
const monthDate = (month: string) => `${month}-15`;

function tickLabel(month: string, byYear: boolean) {
  return byYear ? month.slice(0, 4) : `${formatMonthShort(monthDate(month)).slice(0, 3)} ${month.slice(2, 4)}`;
}

export function PanelChart({ title, description, kind, unit, series, rows, source, size, headline, className }: PanelChartProps) {
  const id = useId();
  const drawn = series.filter((s) => s.available);
  const config = Object.fromEntries(drawn.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig;
  const months = rows.map((row) => row.month);
  const byYear = months.length > 36;
  const ticks = periodTicks(months, byYear ? "year" : "month", size === "lg" ? 8 : 4);
  const Chart = kind === "bar" ? BarChart : LineChart;
  // Round ticks that hug the data; columns always include zero.
  const values = rows.flatMap((row) => drawn.map((s) => row[s.key]).filter((v): v is number => typeof v === "number"));
  const low = Math.min(...values, ...(kind === "bar" ? [0] : []));
  const high = Math.max(...values, ...(kind === "bar" ? [0] : []));
  const yTicks = linearTicks(low, high, size === "lg" ? 5 : 3);
  const yDomain = [Math.min(low, yTicks[0]), Math.max(high, yTicks.at(-1)!)];

  return (
    <article
      aria-labelledby={`${id}-title`}
      className={cn("flex min-w-0 flex-col gap-2 rounded-lg border-t-[3px] border-t-tone bg-card p-3 ring-1 ring-foreground/10", className)}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 id={`${id}-title`} className={cn("font-semibold", size === "lg" ? "text-base" : "text-sm")}>
            {title}
          </h2>
          <p className={cn("text-xs text-muted-foreground", size === "sm" && "line-clamp-1")} title={description}>
            {description}
          </p>
        </div>
        {headline}
      </header>

      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground" aria-label="Series">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.label}
              {s.available ? null : " (sin datos)"}
            </li>
          ))}
        </ul>
      ) : null}

      {drawn.length && rows.length > 1 ? (
        <ChartContainer
          config={config}
          className={cn("aspect-auto w-full min-w-0", size === "lg" ? "min-h-72 flex-1" : "h-28")}
          initialDimension={{ width: 300, height: size === "lg" ? 288 : 112 }}
        >
          <Chart data={rows} syncId={SYNC_ID} syncMethod="value" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              ticks={ticks}
              interval={0}
              tick={{ fontSize: 10 }}
              tickFormatter={(month: string) => tickLabel(month, byYear)}
            />
            <YAxis
              width={size === "lg" ? 68 : 56}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              ticks={yTicks}
              domain={yDomain}
              interval={0}
              // Basis points without the unit: the description names it and the ticks stay on one line.
              tickFormatter={(value: number) => (unit === "bps" ? formatNumber(value) : formatAxisValue(value, unit))}
            />
            {kind === "bar" ? <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.6} /> : null}
            <Tooltip
              cursor={kind === "bar" ? { fill: "var(--foreground)", fillOpacity: 0.06 } : { stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="flex flex-col gap-0.5 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
                    <span className="text-muted-foreground">Cierre de {formatMonth(monthDate(String(label)))}</span>
                    {payload.map((entry) => {
                      const s = drawn.find((d) => d.key === entry.dataKey);
                      return s && typeof entry.value === "number" ? (
                        <span key={s.key} className="flex items-center gap-1.5">
                          {drawn.length > 1 ? <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden /> : null}
                          {drawn.length > 1 ? <span className="text-muted-foreground">{s.label}</span> : null}
                          <span className="font-medium tabular-nums">{formatValue(entry.value, unit)}</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                );
              }}
            />
            {drawn.map((s) =>
              kind === "bar" ? (
                <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[2, 2, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              ) : (
                <Line key={s.key} type="linear" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false} isAnimationActive={false} />
              ),
            )}
          </Chart>
        </ChartContainer>
      ) : (
        <p className={cn("flex items-center justify-center text-center text-sm text-muted-foreground", size === "lg" ? "min-h-72 flex-1" : "h-28")}>
          {drawn.length ? "No hay datos en este período." : `No disponible: ${source} no respondió.`}
        </p>
      )}

      <p className="mt-auto text-[11px] text-muted-foreground">
        Fuente: <SourceCitation source={source} />
      </p>
    </article>
  );
}
