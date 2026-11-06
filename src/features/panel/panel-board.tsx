"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { LINE_COLORS } from "@/components/dashboard/chart-colors";
import { ZoomBar } from "@/components/dashboard/chart-zoom";
import { toneVar, VARIABLE_TONES } from "@/components/dashboard/tones";
import { formatChange, formatDate, formatMonth, formatValue } from "@/lib/format";
import {
  chartKind,
  mergeByMonth,
  PANEL_CHARTS,
  PANEL_KPIS,
  type Panel,
  type PanelChart as PanelChartSpec,
  type PanelVariable,
} from "@/lib/indicators/panel";
import type { ZoomWindow } from "@/lib/indicators/zoom";
import { CITATION_SEPARATOR } from "@/lib/sources/citations";
import { cn } from "@/lib/utils";
import { formatPanelMonth, PanelChart, type ChartSeries } from "./panel-chart";

/** CSS color of a variable's topic tone. */
const variableColor = (key: string) => toneVar(VARIABLE_TONES[key] ?? "dollars");
const toneStyle = (key: string) => ({ "--tone": variableColor(key) }) as CSSProperties;

/** Several dollars share the categorical palette (same order as on "Hoy"); other pairs keep their topic tones. */
function seriesColors(chart: PanelChartSpec): string[] {
  if (chart.key === "dollars") return chart.series.map((_, i) => LINE_COLORS[i]);
  return chart.series.map(variableColor);
}

const sourcesOf = (variables: PanelVariable[]) => [...new Set(variables.map((v) => v.source))].join(CITATION_SEPARATOR);

/** Daily series show the exact day of their latest value; monthly ones, the month. */
function lastDate(variable: PanelVariable) {
  if (!variable.last) return "";
  return variable.frequency === "monthly" ? formatMonth(variable.last.date) : formatDate(variable.last.date);
}

function KpiCard({ variable, selected, onSelect }: { variable: PanelVariable; selected: boolean; onSelect: () => void }) {
  const change = variable.periodChange;
  const Icon = change === null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      style={toneStyle(variable.key)}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border-t-[3px] border-t-tone bg-card p-3 text-left ring-1 ring-foreground/10 transition-colors",
        "hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring",
        selected && "bg-muted ring-2 ring-tone",
      )}
    >
      <span className="truncate text-xs font-medium text-muted-foreground" title={variable.label}>
        {variable.label}
      </span>
      {variable.status === "ok" && variable.last ? (
        <>
          <span className="text-xl font-bold tracking-tight tabular-nums">{formatValue(variable.last.value, variable.unit)}</span>
          <span className="flex items-center gap-1 text-xs text-foreground/85">
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {change === null ? "—" : formatChange(change, variable.change)}
            <span className="truncate text-muted-foreground">en el período</span>
          </span>
        </>
      ) : (
        <span className="py-2 text-sm text-muted-foreground">{variable.status === "error" ? "No disponible" : "Sin datos en el período"}</span>
      )}
    </button>
  );
}

function toSeries(variables: PanelVariable[], colors: string[], labels: Record<string, string> = {}): ChartSeries[] {
  return variables.map((v, i) => ({
    key: v.key,
    label: labels[v.key] ?? v.label,
    color: colors[i],
    available: v.status === "ok" && v.points.length > 0,
  }));
}

export function PanelBoard({ panel }: { panel: Panel }) {
  const [selected, setSelected] = useState<string>(PANEL_KPIS[0]);
  const featured = panel.variables[selected];
  // One zoom for every chart, cleared when the period changes.
  const rangeKey = `${panel.range.from}:${panel.range.to}`;
  const [zoomState, setZoomState] = useState<{ range: string; window: ZoomWindow | null }>({ range: rangeKey, window: null });
  const zoom = zoomState.range === rangeKey ? zoomState.window : null;
  const setZoom = (window: ZoomWindow | null) => setZoomState({ range: rangeKey, window });

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Indicadores clave" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-10">
        {PANEL_KPIS.map((key) => (
          <KpiCard key={key} variable={panel.variables[key]} selected={key === selected} onSelect={() => setSelected(key)} />
        ))}
      </section>

      <ZoomBar window={zoom} onReset={() => setZoom(null)} format={formatPanelMonth} className="rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div style={toneStyle(featured.key)} className="flex md:col-span-2 xl:row-span-2" aria-live="polite">
          <PanelChart
            className="flex-1"
            size="lg"
            title={featured.label}
            description={`${featured.description} Elegí otro indicador arriba para verlo acá.`}
            kind={chartKind([featured.key])}
            unit={featured.unit}
            series={toSeries([featured], [variableColor(featured.key)])}
            rows={mergeByMonth([featured])}
            source={featured.source}
            zoom={zoom}
            onZoom={setZoom}
            slider
            headline={
              featured.last ? (
                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-2xl font-bold tabular-nums">{formatValue(featured.last.value, featured.unit)}</span>
                  <span className="text-xs text-muted-foreground">{lastDate(featured)}</span>
                </div>
              ) : null
            }
          />
        </div>

        {PANEL_CHARTS.map((chart) => {
          const variables = chart.series.map((key) => panel.variables[key]);
          return (
            <div key={chart.key} style={toneStyle(chart.series[0])} className="flex">
              <PanelChart
                className="flex-1"
                size="sm"
                title={chart.title}
                description={chart.description}
                kind={chartKind(chart.series)}
                unit={variables[0].unit}
                series={toSeries(variables, seriesColors(chart), chart.labels)}
                rows={mergeByMonth(variables)}
                source={sourcesOf(variables)}
                zoom={zoom}
                onZoom={setZoom}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
