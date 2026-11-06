"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Suspense, useState, useTransition, type CSSProperties } from "react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { toneVar } from "@/components/dashboard/tones";
import { formatArs, formatDate, formatNumber } from "@/lib/format";
import type { PricePoint, PriceView } from "@/lib/indicators/prices";
import { SOURCE_NAMES } from "@/lib/sources/citations";
import { cn } from "@/lib/utils";
import { PriceSearch } from "./price-search";

/** MapLibre runs only in the browser and ships only with this page. */
const PriceMap = dynamic(() => import("./price-map").then((m) => m.PriceMap), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

/** At most about 60 % of a phone's height, so the page can still be scrolled and pinched around the map. */
const MAP_HEIGHT = "h-[60svh] md:h-[min(40rem,70svh)]";
const TABLE_ROWS = 20;

function MapPlaceholder() {
  return <div className={cn(MAP_HEIGHT, "animate-pulse bg-[#f2f3f0]")} aria-hidden />;
}

export const pricesHref = (ean: string) => `/precios?producto=${encodeURIComponent(ean)}`;

/** The SEPA day on show and its size. */
export type PriceDay = { date: string; chains: number; branches: number; products: number };

type PriceExplorerProps = {
  day: PriceDay;
  view: PriceView | null;
  /** A barcode in the address that the latest day does not list. */
  missing: string | null;
};

/** The product search, and for the picked product its price summary, map and table. */
export function PriceExplorer({ day, view, missing }: PriceExplorerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6" aria-busy={pending}>
      <PriceSearch
        key={view?.ean ?? "none"}
        initialQuery={view?.name}
        showExamples={!view}
        onPick={(hit) => startTransition(() => router.push(pricesHref(hit.ean), { scroll: false }))}
      />

      {!view ? (
        <p className="text-sm text-muted-foreground">
          Precios del {formatDate(day.date)}: {formatNumber(day.products)} productos en {formatNumber(day.branches)} sucursales de{" "}
          {day.chains} cadenas.
        </p>
      ) : null}

      {missing ? (
        <p className="rounded-lg bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
          Ningún supermercado informó el código de barras {missing} en el último día. Buscalo por nombre arriba.
        </p>
      ) : null}

      {view ? <ProductPrices view={view} pending={pending} /> : null}
    </div>
  );
}

function ProductPrices({ view, pending }: { view: PriceView; pending: boolean }) {
  const { summary } = view;
  const cheapest = view.points[0];
  const priciest = view.points.at(-1);
  const where = (point: PricePoint | undefined) => (point ? `${point.chain}, ${point.locality}` : null);

  return (
    <section aria-labelledby="product-name" className={cn("flex flex-col gap-4 transition-opacity", pending && "opacity-70")}>
      <header className="flex flex-col gap-1">
        <h2 id="product-name" className="text-2xl font-bold tracking-tight">
          {view.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          {view.brand ? `${view.brand}. ` : ""}Código de barras {view.ean}. En {formatNumber(summary.stores)}{" "}
          {summary.stores === 1 ? "sucursal" : "sucursales"} de {summary.chains} {summary.chains === 1 ? "cadena" : "cadenas"}, precios de
          lista del {formatDate(view.date)}.
        </p>
      </header>

      {/* On phones the map comes right after the name, before the three tiles. */}
      <div className="grid gap-4 max-sm:order-1 sm:grid-cols-3" style={{ "--tone": toneVar("inflation") } as CSSProperties}>
        <StatTile label="Más barato" value={formatArs(summary.min, 2)} secondary={where(cheapest)} source={SOURCE_NAMES.sepa} size="md" />
        <StatTile
          label="Precio mediano"
          value={formatArs(summary.median, 2)}
          secondary="La mitad de las sucursales cobra menos que esto."
          source={SOURCE_NAMES.sepa}
          size="md"
        />
        <StatTile label="Más caro" value={formatArs(summary.max, 2)} secondary={where(priciest)} source={SOURCE_NAMES.sepa} size="md" />
      </div>

      <section aria-label={`Mapa de precios de ${view.name}`} className="overflow-hidden rounded-lg bg-[#fcfcfb] ring-1 ring-foreground/10">
        <div className={MAP_HEIGHT}>
          <Suspense fallback={<MapPlaceholder />}>
            <PriceMap view={view} />
          </Suspense>
        </div>
        <PriceLegend view={view} />
      </section>

      <div className="max-sm:order-2">
        <PriceTable view={view} />
      </div>
    </section>
  );
}

function PriceLegend({ view }: { view: PriceView }) {
  return (
    <div className="flex flex-col gap-2 border-t border-foreground/10 px-4 py-3 text-xs text-[#52514e]">
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Colores por precio">
        {view.classes.map((c) => (
          <li key={c.color} className="flex items-center gap-1.5 tabular-nums">
            <span className="size-3 rounded-full ring-1 ring-black/10" style={{ background: c.color }} aria-hidden />
            {c.from === c.to ? formatArs(c.from) : `${formatArs(c.from)} a ${formatArs(c.to)}`}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full ring-2 ring-[#0b0b0b]" aria-hidden />
          El precio más bajo
        </li>
      </ul>
      <p>
        Cada punto es una sucursal, de más claro (más barato) a más oscuro (más caro). Si dos precios se tapan se muestra el más
        barato; acercá el mapa para ver el resto.
      </p>
    </div>
  );
}

function PriceTable({ view }: { view: PriceView }) {
  const [all, setAll] = useState(false);
  const rows = all ? view.points : view.points.slice(0, TABLE_ROWS);
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <caption className="px-4 py-3 text-left text-sm text-muted-foreground">
            Precio de lista de {view.name} en cada sucursal, del más barato al más caro, el {formatDate(view.date)}. Fuente:{" "}
            {SOURCE_NAMES.sepa}.
          </caption>
          <thead className="bg-card text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Precio
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Cadena
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Sucursal
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Dirección
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Localidad
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((point) => (
              <tr key={point.id} className="border-t border-foreground/10">
                <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatArs(point.price, 2)}</td>
                <td className="px-4 py-2">{point.chain}</td>
                <td className="px-4 py-2">{point.name}</td>
                <td className="px-4 py-2">{point.address}</td>
                <td className="px-4 py-2">
                  {point.locality}, {point.province}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.points.length > TABLE_ROWS ? (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          className="self-start rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-foreground/15 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          {all ? `Ver solo las ${TABLE_ROWS} más baratas` : `Ver las ${formatNumber(view.points.length)} sucursales`}
        </button>
      ) : null}
    </div>
  );
}
