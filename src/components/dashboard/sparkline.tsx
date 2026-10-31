"use client";

import { Line, LineChart, Tooltip, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatDate, formatValue, type Unit } from "@/lib/format";
import type { Point } from "@/lib/indicators/types";

const config = {
  value: { label: "Valor", color: "var(--tone)" },
} satisfies ChartConfig;

type SparklineProps = {
  points: Point[];
  unit: Unit;
  label: string;
};

/** Recent trend line with a crosshair tooltip, drawn in the section tone. */
export function Sparkline({ points, unit, label }: SparklineProps) {
  const format = (value: number) => formatValue(value, unit);
  if (points.length < 2) return null;
  const first = points[0];
  const last = points.at(-1)!;

  return (
    <figure className="flex flex-col gap-1">
      <ChartContainer
        config={config}
        className="aspect-auto h-16 w-full min-w-0"
        // Small initial size so the chart never forces its card wider than a phone screen.
        initialDimension={{ width: 200, height: 64 }}
        role="img"
        aria-label={`${label}: ${format(first.value)} el ${formatDate(first.date)}, ${format(last.value)} el ${formatDate(last.date)}`}
      >
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as Point | undefined;
              if (!active || !point) return null;
              return (
                <div className="rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm">
                  <div className="text-muted-foreground">{formatDate(point.date)}</div>
                  <div className="font-medium">{format(point.value)}</div>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <figcaption className="flex justify-between text-[11px] text-muted-foreground">
        <span>{formatDate(first.date)}</span>
        <span>{formatDate(last.date)}</span>
      </figcaption>
    </figure>
  );
}
