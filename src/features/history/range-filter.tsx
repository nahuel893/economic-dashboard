"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { HISTORY_FLOOR, shiftMonths, type MonthRange } from "@/lib/indicators/history";
import { MARK_LAYERS, serializeMarks, type MarkLayerKey } from "@/lib/indicators/marks";
import { cn } from "@/lib/utils";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const PRESETS = [
  { label: "1 año", years: 1 },
  { label: "3 años", years: 3 },
  { label: "5 años", years: 5 },
  { label: "10 años", years: 10 },
  { label: "Todo", years: null },
] as const;

function href(path: string, range: MonthRange, marks: MarkLayerKey[]) {
  const params = new URLSearchParams({ desde: range.from, hasta: range.to });
  const marcas = serializeMarks(marks);
  if (marcas) params.set("marcas", marcas);
  return `${path}?${params.toString()}`;
}

const chipClass =
  "rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-foreground/15 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

const selectClass =
  "h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";

type RangeFilterProps = {
  range: MonthRange;
  latest: string;
  /** Page the filter navigates on. */
  path?: string;
  /** Active mark layers; without them the page has no marks and their toggles are hidden. */
  marks?: MarkLayerKey[];
};

export function RangeFilter({ range, latest, path = "/historico", marks: markLayers }: RangeFilterProps) {
  const marks = markLayers ?? [];
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const firstYear = Number(HISTORY_FLOOR.slice(0, 4));
  const years = Array.from({ length: Number(latest.slice(0, 4)) - firstYear + 1 }, (_, i) => firstYear + i);

  const go = (next: MonthRange, nextMarks = marks) =>
    startTransition(() => router.push(href(path, next, nextMarks), { scroll: false }));
  const toggleMark = (key: MarkLayerKey) =>
    go(range, marks.includes(key) ? marks.filter((k) => k !== key) : [...marks, key]);
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav aria-label="Períodos rápidos" className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const target = presetRange(preset.years);
            const current = target.from === range.from && target.to === range.to;
            return (
              <Link
                key={preset.label}
                href={href(path, target, marks)}
                scroll={false}
                aria-current={current ? "true" : undefined}
                className={cn(chipClass, current && "bg-primary text-primary-foreground ring-primary hover:bg-primary")}
              >
                {preset.label}
              </Link>
            );
          })}
        </nav>
        {markLayers ? (
          <div role="group" aria-label="Marcas en los gráficos" className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-muted-foreground" aria-hidden>
              Marcas
            </span>
            {MARK_LAYERS.map((layer) => {
              const on = marks.includes(layer.key);
              return (
                <button
                  key={layer.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleMark(layer.key)}
                  className={cn(chipClass, "flex items-center gap-1.5", on && "bg-muted ring-foreground/40")}
                >
                  <span
                    aria-hidden
                    className={cn("size-2.5 rounded-sm ring-1 ring-foreground/40", on && "bg-foreground ring-foreground")}
                  />
                  {layer.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {endControls("from", "Desde")}
        {endControls("to", "Hasta")}
      </div>
    </div>
  );
}
