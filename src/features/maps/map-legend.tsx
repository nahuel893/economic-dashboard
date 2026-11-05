import { SourceCitation } from "@/components/dashboard/source-citation";
import { formatValue } from "@/lib/format";
import { HIGH_CV, NO_DATA_COLOR, type MapView } from "@/lib/indicators/maps";
import { cn } from "@/lib/utils";

const GEOMETRY_NOTES: Record<MapView["geometry"], string> = {
  areas: "Cada provincia con su valor; Buenos Aires se divide en los partidos del Gran Buenos Aires y el resto de la provincia.",
  regions: "Cada provincia toma el valor de su región: el INDEC publica el IPC por región, no por provincia.",
  aglomerados:
    "Cada punto es un aglomerado urbano de la EPH: el INDEC no publica este dato por provincia ni fuera de las ciudades.",
  departments:
    "Cada departamento, partido o comuna con su valor: el Censo 2022 los publica con esta apertura, no por provincia. El mapa no dibuja la Antártida Argentina ni las islas del Atlántico Sur.",
};

function Swatch({ color, ring = false }: { color: string; ring?: boolean }) {
  return ring ? (
    <span aria-hidden className="inline-block size-4 shrink-0 rounded-full border-2 border-[#0b0b0b]" />
  ) : (
    <span aria-hidden className="inline-block size-3.5 shrink-0 rounded-sm ring-1 ring-black/15" style={{ background: color }} />
  );
}

/**
 * The color scale as a palette bar, lowest to highest, with each color's range
 * under it; then "Sin dato", the high-CV marker and the period's note. The
 * colors are discrete classes, so the bar is blocks, not a gradient.
 */
export function MapLegend({ view }: { view: MapView }) {
  const hasNoData = view.places.some((p) => p.value === null);
  const hasHighCv = view.places.some((p) => p.highCv);
  return (
    <div className="flex flex-col gap-2 px-4 py-3 text-xs text-[#52514e]">
      <p className="text-sm font-semibold text-[#0b0b0b]">
        {view.variantLabel}, {view.periodLabel}
      </p>
      {/* A vertical palette on phones, where five ranges do not fit side by side; a horizontal bar from sm up. */}
      <ol
        aria-label="Escala de colores, de menor a mayor"
        className="flex w-full max-w-2xl flex-col sm:grid sm:gap-x-px"
        style={{ gridTemplateColumns: `repeat(${view.classes.length}, minmax(0, 1fr))` }}
      >
        {view.classes.map((c, i) => {
          const first = i === 0;
          const last = i === view.classes.length - 1;
          return (
            <li key={c.color} className="flex min-w-0 items-center gap-2 sm:flex-col sm:items-stretch sm:gap-1">
              <span
                aria-hidden
                className={cn(
                  "h-5 w-3.5 shrink-0 sm:h-3.5 sm:w-auto",
                  first && "rounded-t-sm sm:rounded-t-none sm:rounded-l-sm",
                  last && "rounded-b-sm sm:rounded-b-none sm:rounded-r-sm",
                )}
                style={{ background: c.color }}
              />
              <span className="text-[11px] leading-tight tabular-nums sm:text-center">
                {c.from === c.to ? (
                  formatValue(c.from, view.unit)
                ) : (
                  <>
                    <span className="sm:block">{formatValue(c.from, view.unit)}</span>{" "}
                    <span className="whitespace-nowrap sm:block">a {formatValue(c.to, view.unit)}</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {hasNoData || hasHighCv ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
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
      ) : null}
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
