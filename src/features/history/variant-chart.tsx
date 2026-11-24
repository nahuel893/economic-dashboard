"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { HistoryChart, type HistoryChartProps } from "./history-chart";

export type VariantOption = { key: string; option: string; chart: HistoryChartProps };

type VariantChartProps = {
  options: VariantOption[];
  /** Key of the series shown first. */
  initial: string;
};

/** A history chart whose series is picked with a row of buttons, e.g. original, seasonally adjusted or trend-cycle. */
export function VariantChart({ options, initial }: VariantChartProps) {
  const [selected, setSelected] = useState(initial);
  const current = options.find((o) => o.key === selected) ?? options[0];

  const controls = (
    <div role="group" aria-label="Tipo de serie" className="flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1">
      {options.map((o) => {
        const on = o.key === current.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => setSelected(o.key)}
            className={cn(
              "flex-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              on && "bg-card text-foreground ring-1 ring-tone/60",
            )}
          >
            {o.option}
          </button>
        );
      })}
    </div>
  );

  return <HistoryChart {...current.chart} controls={controls} />;
}
