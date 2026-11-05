import { SourceCitation } from "@/components/dashboard/source-citation";
import { formatValue } from "@/lib/format";
import { HIGH_CV, NO_DATA_COLOR, type MapView } from "@/lib/indicators/maps";

const GEOMETRY_NOTES: Record<MapView["geometry"], string> = {
  areas: "Cada provincia con su valor; Buenos Aires se divide en los partidos del Gran Buenos Aires y el resto de la provincia.",
  regions: "Cada provincia toma el valor de su región: el INDEC publica el IPC por región, no por provincia.",
  aglomerados:
    "Cada punto es un aglomerado urbano de la EPH: el INDEC no publica este dato por provincia ni fuera de las ciudades.",
};

function Swatch({ color, ring = false }: { color: string; ring?: boolean }) {
  return ring ? (
    <span aria-hidden className="inline-block size-4 shrink-0 rounded-full border-2 border-[#0b0b0b]" />
  ) : (
    <span aria-hidden className="inline-block size-3.5 shrink-0 rounded-sm ring-1 ring-black/15" style={{ background: color }} />
  );
}

/** The color scale with its ranges and units, plus "Sin dato", the high-CV marker and the period's note. */
export function MapLegend({ view }: { view: MapView }) {
  const hasNoData = view.places.some((p) => p.value === null);
  const hasHighCv = view.places.some((p) => p.highCv);
  return (
    <div className="flex flex-col gap-2 px-4 py-3 text-xs text-[#52514e]">
      <p className="text-sm font-semibold text-[#0b0b0b]">
        {view.variantLabel}, {view.periodLabel}
      </p>
      <ul aria-label="Escala de colores" className="flex flex-wrap gap-x-4 gap-y-1.5">
        {view.classes.map((c) => (
          <li key={c.color} className="flex items-center gap-1.5 tabular-nums">
            <Swatch color={c.color} />
            {c.from === c.to ? formatValue(c.from, view.unit) : `${formatValue(c.from, view.unit)} a ${formatValue(c.to, view.unit)}`}
          </li>
        ))}
        {hasNoData ? (
          <li className="flex items-center gap-1.5">
            <Swatch color={NO_DATA_COLOR} />
            Sin dato
          </li>
        ) : null}
        {hasHighCv ? (
          <li className="flex items-center gap-1.5">
            <Swatch color="" ring />
            Usar con cuidado: coeficiente de variación mayor al {HIGH_CV} %
          </li>
        ) : null}
      </ul>
      {view.note ? <p className="font-medium text-[#0b0b0b]">⚠ {view.note}.</p> : null}
      <p>
        {GEOMETRY_NOTES[view.geometry]} {view.description} Fuente:{" "}
        <span className="[&_a:hover]:text-[#0b0b0b] [&_a:focus-visible]:text-[#0b0b0b]">
          <SourceCitation source={view.source} />
        </span>
        .
      </p>
    </div>
  );
}
