"use client";

import { Bar, BarChart, Cell, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatMonth, formatMonthShort, formatNumber, formatValue, type Unit } from "@/lib/format";
import type { Point } from "@/lib/indicators/types";

const config = {
  value: { label: "Valor", color: "var(--tone)" },
} satisfies ChartConfig;

type ColumnChartProps = {
  points: Point[];
  unit: Unit;
  label: string;
};

/**
 * Monthly columns with the value printed on each bar. The latest month is drawn
 * in the full section tone and earlier months are muted, so the new data point
 * stands out.
 */
export function ColumnChart({ points, unit, label }: ColumnChartProps) {
  if (points.length < 2) return null;
  const last = points.length - 1;

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-36 w-full min-w-0"
      initialDimension={{ width: 200, height: 144 }}
      role="img"
      aria-label={`${label}: ${points.map((p) => `${formatMonth(p.date)} ${formatValue(p.value, unit)}`).join(", ")}`}
    >
      <BarChart data={points} margin={{ top: 18, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
        <YAxis hide domain={[0, "dataMax"]} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          interval={0}
          tickMargin={4}
          tick={{ fontSize: 10 }}
          tickFormatter={(date: string) => formatMonthShort(date).slice(0, 3)}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as Point | undefined;
            if (!active || !point) return null;
            return (
              <div className="rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm">
                <div className="text-muted-foreground">{formatMonth(point.date)}</div>
                <div className="font-medium">{formatValue(point.value, unit)}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {points.map((point, i) => (
            <Cell key={point.date} fill="var(--color-value)" fillOpacity={i === last ? 1 : 0.45} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            offset={4}
            className="fill-foreground"
            fontSize={10}
            formatter={(value) => formatNumber(Number(value), 1)}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
