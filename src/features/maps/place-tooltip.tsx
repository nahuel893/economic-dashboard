import { formatValue } from "@/lib/format";
import { placeWarnings, type MapPlace, type MapView } from "@/lib/indicators/maps";

/** What the map says about one place: value with unit, period, short source and caveats. */
export function PlaceTooltip({ view, place, areaName }: { view: MapView; place: MapPlace; areaName?: string }) {
  const warnings = place.value === null ? [] : placeWarnings(place, view.note);
  return (
    <div className="flex flex-col gap-1 rounded-md bg-[#fcfcfb] px-3 py-2 text-xs text-[#52514e] shadow-lg ring-1 ring-black/10">
      <p className="text-sm font-semibold text-[#0b0b0b]">
        {view.geometry === "regions" ? `Región ${place.name}` : place.name}
        {areaName ? <span className="font-normal text-[#52514e]"> ({areaName})</span> : null}
      </p>
      <p>
        {view.variantLabel}:{" "}
        <span className="font-semibold text-[#0b0b0b] tabular-nums">
          {place.value === null ? "Sin dato" : formatValue(place.value, view.unit)}
        </span>
      </p>
      <p>
        {view.periodLabel} · {view.source}
      </p>
      {warnings.map((warning) => (
        <p key={warning} className="font-medium text-[#0b0b0b]">
          ⚠ {warning}
        </p>
      ))}
    </div>
  );
}
