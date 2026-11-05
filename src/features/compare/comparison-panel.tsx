"use client";

import { useId, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { useZoomDrag, ZoomBar } from "@/components/dashboard/chart-zoom";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatDate, formatMonth, formatMonthShort, formatNumber, formatValue } from "@/lib/format";

const formatPoints = (value: number, decimals: number) =>
  `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatNumber(Math.abs(value), decimals)} pp`;
import { changeSinceStart, correlate, mergeByDate, rebase100, type Correlation } from "@/lib/indicators/stats";
import type { Point } from "@/lib/indicators/types";
import { LINE_COLORS } from "@/components/dashboard/chart-colors";
import { linearTicks } from "@/lib/indicators/history";
import { inWindow, type ZoomWindow } from "@/lib/indicators/zoom";
import { cn } from "@/lib/utils";
import type { CompareSpec, CompareVariable } from "./specs";


function formatAxisDate(date: string, frequency: CompareSpec["frequency"]): string {
  return frequency === "monthly" ? `${formatMonthShort(date).slice(0, 3)} ${date.slice(2, 4)}` : `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** In relative modes every series starts on the same date, so all lines begin together (at 100 or at 0). */
function chartPoints(variables: CompareVariable[], mode: CompareSpec["mode"]): { key: string; points: Point[] }[] {
  if (mode === "level") return variables.map((v) => ({ key: v.key, points: v.points }));
  const start = variables.reduce((latest, v) => {
    const first = v.points.reduce((min, p) => (p.date < min ? p.date : min), v.points[0].date);
    return first > latest ? first : latest;
  }, "");
  const transform = mode === "index100" ? rebase100 : changeSinceStart;
  return variables.map((v) => ({ key: v.key, points: transform(v.points.filter((p) => p.date >= start)) }));
}

export function ComparisonPanel({ spec, title }: { spec: CompareSpec; title: string }) {
  const id = useId();
  // Every variable starts selected.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const colorOf = (key: string) => LINE_COLORS[spec.variables.findIndex((v) => v.key === key) % LINE_COLORS.length];
  const active = spec.variables.filter((v) => !hidden.has(v.key));

  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const series = active.length ? chartPoints(active, spec.mode) : [];
  const allRows = mergeByDate(series);
  // Visual zoom over the dates; the correlations keep using every point.
  const [zoom, setZoom] = useState<ZoomWindow | null>(null);
  const zoomDrag = useZoomDrag(allRows.map((row) => row.date), setZoom);
  const rows = inWindow(allRows, (row) => row.date, zoom);
  // While zoomed the Y axis fits the visible values; otherwise the library rounds it.
  const visible = rows.flatMap((row) => active.map((v) => row[v.key]).filter((y): y is number => typeof y === "number"));
  const yTicks = zoom && visible.length ? linearTicks(Math.min(...visible), Math.max(...visible), 5) : undefined;
  const yDomain = zoom && visible.length ? [Math.min(...visible), Math.max(...visible)] : ["auto", "auto"];

  if (spec.variables.length < 2) return null;
  const config = Object.fromEntries(
    spec.variables.map((v) => [v.key, { label: v.label, color: colorOf(v.key) }]),
  ) satisfies ChartConfig;
  const formatY = (value: number) =>
    spec.mode === "index100" ? formatNumber(value, 0) : spec.mode === "change" ? formatPoints(value, 1) : formatValue(value, spec.unit);
  const formatTooltip = (value: number) =>
    spec.mode === "index100" ? formatNumber(value, 1) : spec.mode === "change" ? formatPoints(value, 2) : formatValue(value, spec.unit);
  const first = allRows[0]?.date;
  const last = allRows.at(-1)?.date;

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">
          {spec.mode === "index100"
            ? "Base 100 al inicio del período."
            : spec.mode === "change"
              ? "Variación acumulada en puntos porcentuales desde el inicio del período."
              : "Valores en su unidad original."}
          {first && last ? ` Del ${formatDate(first)} al ${formatDate(last)}.` : null}
        </p>
      </div>

      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="sr-only">Variables del gráfico</legend>
        {spec.variables.map((v) => (
          <label key={v.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-ring"
              style={{ accentColor: colorOf(v.key) }}
              checked={!hidden.has(v.key)}
              onChange={() => toggle(v.key)}
            />
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: colorOf(v.key) }} aria-hidden />
            {v.label}
          </label>
        ))}
      </fieldset>

      {rows.length > 1 ? (
        <div {...zoomDrag.containerProps}>
          <ChartContainer config={config} className="aspect-auto h-64 w-full min-w-0" initialDimension={{ width: 300, height: 256 }}>
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} {...zoomDrag.chartProps}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              {zoomDrag.selection ? (
                <ReferenceArea x1={zoomDrag.selection.start} x2={zoomDrag.selection.end} fill="var(--foreground)" fillOpacity={0.12} />
              ) : null}
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tick={{ fontSize: 11 }}
                tickFormatter={(d: string) => formatAxisDate(d, spec.frequency)}
              />
              <YAxis
                width={72}
                tickLine={false}
                axisLine={false}
                domain={yDomain}
                ticks={yTicks}
                tick={{ fontSize: 11 }}
                tickFormatter={formatY}
              />
              {spec.mode !== "level" ? (
                <ReferenceLine y={spec.mode === "index100" ? 100 : 0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              ) : null}
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
                content={({ active: isActive, payload, label }) => {
                  if (!isActive || !payload?.length) return null;
                  return (
                    <div className="flex flex-col gap-1 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
                      <span className="text-muted-foreground">
                        {spec.frequency === "monthly" ? formatMonth(String(label)) : formatDate(String(label))}
                      </span>
                      {payload.map((entry) => (
                        <span key={String(entry.dataKey)} className="flex items-center gap-2">
                          <span className="size-2 rounded-full" style={{ background: colorOf(String(entry.dataKey)) }} aria-hidden />
                          <span className="text-muted-foreground">{config[String(entry.dataKey)]?.label}</span>
                          <span className="ml-auto font-medium">{formatTooltip(Number(entry.value))}</span>
                        </span>
                      ))}
                    </div>
                  );
                }}
              />
              {active.map((v) => (
                <Line
                  key={v.key}
                  type="monotone"
                  dataKey={v.key}
                  stroke={colorOf(v.key)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">Elegí al menos una variable para ver el gráfico.</p>
      )}

      <ZoomBar window={zoom} onReset={() => setZoom(null)} format={(date) => formatAxisDate(date, spec.frequency)} />

      <CorrelationMatrix id={id} spec={spec} active={active} />

      <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
        {spec.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

type Cell =
  | { kind: "value"; result: Correlation }
  | { kind: "mechanical"; reason: string };

function CorrelationMatrix({ id, spec, active }: { id: string; spec: CompareSpec; active: CompareVariable[] }) {
  const vars = active.filter((v) => v.correlate);
  if (!spec.variables.some((v) => v.correlate)) return null;
  if (vars.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Elegí al menos dos variables que se puedan correlacionar para ver la correlación.
      </p>
    );
  }

  const cell = (a: CompareVariable, b: CompareVariable): Cell => {
    const mechanical = spec.mechanical.find((m) => (m.a === a.key && m.b === b.key) || (m.a === b.key && m.b === a.key));
    if (mechanical) return { kind: "mechanical", reason: mechanical.reason };
    return {
      kind: "value",
      result: correlate(a.points, b.points, spec.change, { weekdaysOnly: spec.frequency === "daily" }),
    };
  };

  return (
    <div className="flex flex-col gap-2">
      <h4 id={`${id}-corr`} className="text-xs font-semibold">
        Correlación entre variaciones
      </h4>
      <div className="overflow-x-auto">
        <table aria-labelledby={`${id}-corr`} className="w-full border-separate border-spacing-0.5 text-xs">
          <thead>
            <tr>
              <td />
              {vars.slice(0, -1).map((v) => (
                <th key={v.key} scope="col" className="px-1 pb-1 text-left font-medium text-muted-foreground">
                  {v.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vars.slice(1).map((row, i) => (
              <tr key={row.key}>
                <th scope="row" className="pr-2 text-left font-medium whitespace-nowrap text-muted-foreground">
                  {row.label}
                </th>
                {vars.slice(0, -1).map((col, j) =>
                  j <= i ? <CorrelationCell key={col.key} cell={cell(row, col)} /> : <td key={col.key} />,
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Pearson sobre variaciones {spec.change === "log" ? "porcentuales" : "en puntos"} de cada{" "}
        {spec.frequency === "monthly" ? "mes" : "día hábil"}, con intervalo de confianza del 95 %. n.s.: no significativa
        (el intervalo incluye el cero). mec.: relacionadas por definición. Correlación no implica causalidad.
      </p>
    </div>
  );
}

function CorrelationCell({ cell }: { cell: Cell }) {
  const base = "h-11 min-w-16 rounded px-1.5 text-center align-middle";
  if (cell.kind === "mechanical") {
    return (
      <td className={cn(base, "bg-muted/40 text-muted-foreground italic")} title={cell.reason}>
        mec.
      </td>
    );
  }
  const { result } = cell;
  if (result.status === "insufficient") {
    return (
      <td className={cn(base, "bg-muted/40 text-muted-foreground")} title={`Pocos datos en común (n = ${result.n})`}>
        —
      </td>
    );
  }
  const { r, n, low, high, significant } = result;
  // Diverging encoding: blue for positive, orange for negative, intensity by |r|; neutral when not significant.
  const background = significant
    ? r >= 0
      ? `rgb(57 135 229 / ${0.15 + Math.abs(r) * 0.5})`
      : `rgb(217 89 38 / ${0.15 + Math.abs(r) * 0.5})`
    : undefined;
  return (
    <td
      className={cn(base, !significant && "bg-muted/40")}
      style={{ background }}
      title={`r = ${formatNumber(r, 2)}, IC 95 %: ${formatNumber(low, 2)} a ${formatNumber(high, 2)}, n = ${n}`}
    >
      <span className={cn("block font-semibold", !significant && "text-muted-foreground")}>{formatNumber(r, 2)}</span>
      <span className="block text-[10px] text-muted-foreground">{significant ? `n = ${n}` : "n.s."}</span>
    </td>
  );
}
