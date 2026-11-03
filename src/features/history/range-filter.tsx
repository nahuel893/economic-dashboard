"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { HISTORY_FLOOR, shiftMonths, type MonthRange } from "@/lib/indicators/history";
import { cn } from "@/lib/utils";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const PRESETS = [
  { label: "1 año", years: 1 },
  { label: "3 años", years: 3 },
  { label: "5 años", years: 5 },
  { label: "10 años", years: 10 },
  { label: "Todo", years: null },
] as const;

const href = (range: MonthRange) => `/historico?desde=${range.from}&hasta=${range.to}`;

const selectClass =
  "h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";

export function RangeFilter({ range, latest }: { range: MonthRange; latest: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const firstYear = Number(HISTORY_FLOOR.slice(0, 4));
  const years = Array.from({ length: Number(latest.slice(0, 4)) - firstYear + 1 }, (_, i) => firstYear + i);

  const go = (next: MonthRange) => startTransition(() => router.push(href(next), { scroll: false }));
  const update = (end: "from" | "to", part: "year" | "month", value: string) => {
    const [year, month] = range[end].split("-");
    const month2 = part === "month" ? value : month;
    go({ ...range, [end]: `${part === "year" ? value : year}-${month2}` });
  };

  const presetRange = (years: number | null): MonthRange => ({
    from: years === null ? HISTORY_FLOOR : shiftMonths(latest, -(years * 12 - 1)),
    to: latest,
  });

  const endControls = (end: "from" | "to", legend: string) => (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">{legend}</legend>
      <span className="text-sm text-muted-foreground" aria-hidden>
        {legend}
      </span>
      <select
        aria-label={`${legend}: mes`}
        className={selectClass}
        value={range[end].slice(5, 7)}
        onChange={(e) => update(end, "month", e.target.value)}
      >
        {MONTHS.map((name, i) => (
          <option key={name} value={String(i + 1).padStart(2, "0")}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label={`${legend}: año`}
        className={selectClass}
        value={range[end].slice(0, 4)}
        onChange={(e) => update(end, "year", e.target.value)}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </fieldset>
  );

  return (
    <div
      aria-busy={pending}
      className={cn(
        "sticky top-0 z-10 -mx-4 flex flex-col gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 md:flex-row md:items-center md:justify-between",
        pending && "opacity-70",
      )}
    >
      <nav aria-label="Períodos rápidos" className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const target = presetRange(preset.years);
          const current = target.from === range.from && target.to === range.to;
          return (
            <Link
              key={preset.label}
              href={href(target)}
              scroll={false}
              aria-current={current ? "true" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-foreground/15 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                current && "bg-primary text-primary-foreground ring-primary hover:bg-primary",
              )}
            >
              {preset.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {endControls("from", "Desde")}
        {endControls("to", "Hasta")}
      </div>
    </div>
  );
}
