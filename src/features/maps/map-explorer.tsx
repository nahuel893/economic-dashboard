"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Suspense, useId, useTransition } from "react";
import { UnavailableTile } from "@/components/dashboard/stat-tile";
import { mapHref, type MapKpiId, type MapView } from "@/lib/indicators/maps";
import { cn } from "@/lib/utils";
import { MapLegend } from "./map-legend";
import { MapTable } from "./map-table";

/** MapLibre runs only in the browser and ships only with this page. */
const MapCanvas = dynamic(() => import("./map-canvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

/** At most about 60 % of a phone's height, so the page can still be scrolled and pinched around the map. */
const MAP_HEIGHT = "h-[60svh] md:h-[min(44rem,75svh)]";

function MapPlaceholder() {
  return <div className={cn(MAP_HEIGHT, "animate-pulse bg-[#f2f3f0]")} aria-hidden />;
}

export type MapKpiOption = { id: MapKpiId; label: string; available: boolean };

export type MapFailure = { label: string; source: string; message: string };

type MapExplorerProps = {
  kpis: MapKpiOption[];
  kpi: MapKpiId;
  /** Null when the KPI failed to load or has no data. */
  view: MapView | null;
  failure: MapFailure | null;
};

const selectClass =
  "h-9 max-w-full rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The KPI, variant and period controls, the map with its legend, and the same values as a table. */
export function MapExplorer({ kpis, kpi, view, failure }: MapExplorerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (href: string) => startTransition(() => router.push(href, { scroll: false }));

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <form className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Qué muestra el mapa" onSubmit={(e) => e.preventDefault()}>
        <Select
          label="Indicador"
          value={kpi}
          // Switching KPI resets the variant and the period to the KPI's defaults.
          onChange={(id) => go(mapHref(id as MapKpiId))}
          options={kpis.map((k) => ({ value: k.id, label: k.available ? k.label : `${k.label} (no disponible)` }))}
        />
        {view && view.variants.length > 1 ? (
          <Select
            label="Valor"
            value={view.variant}
            onChange={(slug) => go(mapHref(view.kpi, slug, view.period))}
            options={view.variants.map((v) => ({ value: v.slug, label: v.label }))}
          />
        ) : null}
        {view ? (
          <Select
            label="Período"
            value={view.period}
            onChange={(period) => go(mapHref(view.kpi, view.variant, period))}
            options={view.periods.map((p) => ({ value: p.slug, label: p.label }))}
          />
        ) : null}
      </form>

      {failure ? (
        <UnavailableTile label={failure.label} source={failure.source} message={failure.message} />
      ) : !view ? (
        <p className="rounded-lg bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
          Este indicador todavía no tiene datos para mostrar.
        </p>
      ) : (
        <>
          <section
            aria-label={`Mapa: ${view.variantLabel}, ${view.periodLabel}`}
            className={cn("overflow-hidden rounded-lg bg-[#fcfcfb] ring-1 ring-foreground/10 transition-opacity", pending && "opacity-70")}
          >
            <div className={MAP_HEIGHT}>
              <Suspense fallback={<MapPlaceholder />}>
                <MapCanvas view={view} />
              </Suspense>
            </div>
            <MapLegend view={view} />
          </section>
          <MapTable view={view} />
        </>
      )}
    </div>
  );
}
