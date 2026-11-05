"use client";

import { useState } from "react";
import { formatNumber, formatValue } from "@/lib/format";
import { type MapView } from "@/lib/indicators/maps";

const PLACE_HEADERS: Record<MapView["geometry"], string> = { areas: "Provincia", regions: "Región", aglomerados: "Aglomerado" };

/** The map's values as a table, sortable by value: the reading path for screen readers and small phones. */
export function MapTable({ view }: { view: MapView }) {
  const [descending, setDescending] = useState(true);
  const rows = [...view.places].sort((a, b) => {
    if (a.value === null || b.value === null) return a.value === null ? (b.value === null ? 0 : 1) : -1;
    return descending ? b.value - a.value : a.value - b.value;
  });
  const hasCv = view.places.some((p) => p.cv !== undefined);

  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <caption className="px-4 py-3 text-left text-sm text-muted-foreground">
          {view.variantLabel} por {PLACE_HEADERS[view.geometry].toLowerCase()}, {view.periodLabel}. Fuente: {view.source}.
          {view.note ? ` ${view.note}.` : null}
        </caption>
        <thead className="bg-card text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              {PLACE_HEADERS[view.geometry]}
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium" aria-sort={descending ? "descending" : "ascending"}>
              <button
                type="button"
                onClick={() => setDescending((d) => !d)}
                className="rounded font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                Valor {descending ? "↓" : "↑"}
                <span className="sr-only">
                  {descending ? ", de mayor a menor. Ordenar de menor a mayor" : ", de menor a mayor. Ordenar de mayor a menor"}
                </span>
              </button>
            </th>
            {hasCv ? (
              <th scope="col" className="px-4 py-2 font-medium">
                Coef. de variación
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((place) => (
            <tr key={place.id} className="border-t border-border">
              <th scope="row" className="px-4 py-1.5 text-left font-normal">
                {place.name}
              </th>
              <td className="px-4 py-1.5 text-right tabular-nums">
                {place.value === null ? <span className="text-muted-foreground">Sin dato</span> : formatValue(place.value, view.unit)}
              </td>
              {hasCv ? (
                <td className="px-4 py-1.5 tabular-nums">
                  {place.cv === undefined ? "" : `${formatNumber(place.cv, 1)} %`}
                  {place.highCv ? <span className="ml-2 font-medium text-foreground">Usar con cuidado</span> : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
