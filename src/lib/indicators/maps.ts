/**
 * The "Mapas" tab: a catalog of the KPIs the map can show, how the URL picks
 * one of them, and the pure work of turning a period's values into colored
 * places. Each KPI is drawn on the geography its source publishes: wages and
 * employment by area, inflation by region (each area takes its region's value), the EPH
 * KPIs by aglomerado, as points, never painted on provinces, and the census by department.
 */
import { formatCompact, formatMonth, type Unit } from "@/lib/format";
import { SOURCE_NAMES } from "@/lib/sources/citations";
import departmentPlaces from "@/lib/sources/snapshots/department-places.json";
import { AGLOMERADOS, AREAS, REGIONS, type AreaId, type LabelPoint } from "./geography";
import type { MapSeries } from "./map-data";

export type MapKpiId = "salarios" | "empleo" | "pobreza" | "inflacion" | "desocupacion" | "actividad" | "censo";

/** Where values are drawn: area fills, area fills by region, aglomerado points, or department fills. */
export type MapGeometry = "areas" | "regions" | "aglomerados" | "departments";

export type MapVariant = {
  /** URL value (`?valor=`). */
  slug: string;
  label: string;
  /** Key of the variant's MapSeries in the KPI's data. */
  series: string;
  description: string;
  /** Unit of the variant's values when it differs from the KPI's. */
  unit?: Unit;
};

export type MapKpi = {
  /** URL value (`?kpi=`). */
  id: MapKpiId;
  label: string;
  geometry: MapGeometry;
  /** Unit of the default variant's values; see `MapVariant.unit`. */
  unit: Unit;
  /** Short source name, as cited on the map. */
  source: string;
  /** The first one is the default. */
  variants: MapVariant[];
};

export const MAP_KPIS: MapKpi[] = [
  {
    id: "salarios",
    label: "Salario promedio",
    geometry: "areas",
    unit: "ars",
    source: SOURCE_NAMES.oede,
    variants: [
      {
        slug: "promedio",
        label: "Salario promedio",
        series: "level",
        description: "Remuneración promedio de los asalariados registrados del sector privado, en pesos corrientes.",
      },
    ],
  },
  {
    id: "empleo",
    label: "Empleo registrado",
    geometry: "areas",
    unit: "percent",
    source: SOURCE_NAMES.oede,
    variants: [
      {
        slug: "variacion",
        label: "Variación interanual",
        series: "yearOnYear",
        description:
          "Variación porcentual de los puestos de trabajo asalariados registrados del sector privado respecto del mismo trimestre del año anterior.",
      },
      {
        slug: "puestos",
        label: "Puestos de trabajo",
        series: "jobs",
        description: "Cantidad de puestos de trabajo asalariados registrados del sector privado.",
        unit: "count",
      },
    ],
  },
  {
    id: "pobreza",
    label: "Pobreza e indigencia",
    geometry: "aglomerados",
    unit: "percent",
    source: SOURCE_NAMES.indecEph,
    variants: [
      { slug: "personas", label: "Pobreza, % de personas", series: "povertyPersons", description: "Personas bajo la línea de pobreza." },
      { slug: "hogares", label: "Pobreza, % de hogares", series: "povertyHouseholds", description: "Hogares bajo la línea de pobreza." },
      {
        slug: "indigencia-personas",
        label: "Indigencia, % de personas",
        series: "indigencePersons",
        description: "Personas bajo la línea de indigencia.",
      },
      {
        slug: "indigencia-hogares",
        label: "Indigencia, % de hogares",
        series: "indigenceHouseholds",
        description: "Hogares bajo la línea de indigencia.",
      },
    ],
  },
  {
    id: "inflacion",
    label: "Inflación",
    geometry: "regions",
    unit: "percent",
    source: SOURCE_NAMES.indec,
    variants: [
      { slug: "mensual", label: "Mensual", series: "monthly", description: "Variación del IPC de cada región contra el mes anterior." },
      {
        slug: "interanual",
        label: "Interanual",
        series: "yearOnYear",
        description: "Variación del IPC de cada región contra el mismo mes del año anterior.",
      },
    ],
  },
  {
    id: "desocupacion",
    label: "Desocupación",
    geometry: "aglomerados",
    unit: "percent",
    source: SOURCE_NAMES.indecEph,
    variants: [
      {
        slug: "tasa",
        label: "Tasa de desocupación",
        series: "unemployment",
        description: "Personas desocupadas como porcentaje de la población económicamente activa.",
      },
    ],
  },
  {
    id: "actividad",
    label: "Actividad y empleo",
    geometry: "aglomerados",
    unit: "percent",
    source: SOURCE_NAMES.indecEph,
    variants: [
      {
        slug: "actividad",
        label: "Tasa de actividad",
        series: "activity",
        description: "Población económicamente activa (ocupados y desocupados) como porcentaje de la población total.",
      },
      {
        slug: "empleo",
        label: "Tasa de empleo",
        series: "employment",
        description: "Población ocupada como porcentaje de la población total.",
      },
    ],
  },
  {
    id: "censo",
    label: "Censo 2022",
    geometry: "departments",
    unit: "count",
    source: SOURCE_NAMES.indecCenso,
    // INDEC publishes no NBI (necesidades básicas insatisfechas) by department for this census, so there is no such variant.
    variants: [
      { slug: "poblacion", label: "Población", series: "population", description: "Personas censadas en 2022, según resultados definitivos del INDEC." },
      {
        slug: "densidad",
        label: "Densidad de población",
        series: "density",
        description:
          "Habitantes por kilómetro cuadrado, con la superficie que publica el INDEC para cada departamento, partido o comuna.",
        unit: "perKm2",
      },
    ],
  },
];

/** A KPI's loaded data: one MapSeries per variant, keyed by `MapVariant.series`. */
export type MapKpiData = Record<string, MapSeries>;

// -- periods ---------------------------------------------------------------------

/** Period keys ("2026-Q2", "2026-H1") in the URL take Spanish letters: "2026-t2", "2026-s1". */
export const periodSlug = (period: string) => period.replace("-Q", "-t").replace("-H", "-s");

const periodFromSlug = (slug: string) => slug.replace("-t", "-Q").replace("-s", "-H");

const ordinal = (n: number) => (n === 1 || n === 3 ? `${n}.er` : `${n}.º`);

/** "junio de 2026", "2.º trimestre de 2026", "1.er semestre de 2026" or a plain year, "2022". */
export function periodLabel(period: string): string {
  const [year, part] = period.split("-");
  if (part === undefined) return year;
  if (part.startsWith("Q")) return `${ordinal(Number(part.slice(1)))} trimestre de ${year}`;
  if (part.startsWith("H")) return `${ordinal(Number(part.slice(1)))} semestre de ${year}`;
  return formatMonth(`${period}-01`);
}

// -- URL state -------------------------------------------------------------------

export type MapParams = { kpi?: string; valor?: string; periodo?: string };

export type MapSelection = { kpi: MapKpi; variant: MapVariant; period: string | null };

/**
 * The view the URL asks for. Unknown or missing values fall back to the first
 * KPI, the KPI's default variant and the variant's latest period; `period` is
 * null only when the variant has no data.
 */
export function resolveMapSelection(
  params: MapParams,
  periodsOf: (kpi: MapKpi, variant: MapVariant) => string[],
): MapSelection {
  const kpi = MAP_KPIS.find((k) => k.id === params.kpi) ?? MAP_KPIS[0];
  const variant = kpi.variants.find((v) => v.slug === params.valor) ?? kpi.variants[0];
  const periods = periodsOf(kpi, variant);
  const asked = params.periodo ? periodFromSlug(params.periodo) : null;
  const period = asked && periods.includes(asked) ? asked : (periods.at(-1) ?? null);
  return { kpi, variant, period };
}

/** Link to a view; without a variant or period the page shows the defaults (switching KPI resets them). */
export function mapHref(kpi: MapKpiId, valor?: string, period?: string): string {
  const params = new URLSearchParams({ kpi });
  if (valor) params.set("valor", valor);
  if (period) params.set("periodo", periodSlug(period));
  return `/mapas?${params.toString()}`;
}

// -- color -----------------------------------------------------------------------

/**
 * One-hue sequential blue scale, light to dark. Validated as an ordinal ramp
 * against the basemap's land (#f2f3f0): monotone lightness, adjacent steps at
 * least 0.06 apart and the lightest step above 2:1 contrast.
 */
export const MAP_COLORS = ["#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"] as const;

/** Places without a value ("Sin dato"). */
export const NO_DATA_COLOR = "#d6d5ce";

export type ColorClass = { color: string; from: number; to: number };

/**
 * Quantile classes over the visible values: each class holds about the same
 * number of distinct values, and its range is the values it actually holds.
 * With fewer distinct values than colors, the classes spread over the scale.
 */
export function colorClasses(values: number[], count = MAP_COLORS.length): ColorClass[] {
  const distinct = [...new Set(values)].sort((a, b) => a - b);
  const k = Math.min(count, distinct.length);
  return Array.from({ length: k }, (_, i) => {
    const slice = distinct.slice(Math.floor((i * distinct.length) / k), Math.floor(((i + 1) * distinct.length) / k));
    const step = k === 1 ? Math.floor((count - 1) / 2) : Math.round((i * (count - 1)) / (k - 1));
    return { color: MAP_COLORS[step], from: slice[0], to: slice.at(-1)! };
  });
}

/** Color of a value: its class, or the no-data gray. */
export function classColor(classes: ColorClass[], value: number | null): string {
  if (value === null || classes.length === 0) return NO_DATA_COLOR;
  return (classes.findLast((c) => c.from <= value) ?? classes[0]).color;
}

// -- the view --------------------------------------------------------------------

/** INDEC's "usar con cuidado": estimates whose coefficient of variation exceeds this, in %. */
export const HIGH_CV = 16;

export type MapPlace = {
  id: string;
  name: string;
  value: number | null;
  cv?: number;
  highCv: boolean;
  color: string;
  /** Point location, for aglomerados. */
  lon?: number;
  lat?: number;
  /** Short value drawn on the map, or null without data. */
  label: string | null;
  /** Where the label sits, as [lon, lat]. */
  labelAt: LabelPoint;
};

export type MapOption = { slug: string; label: string };

/** Everything the client map needs for one KPI, variant and period. Serializable. */
export type MapView = {
  kpi: MapKpiId;
  label: string;
  geometry: MapGeometry;
  unit: Unit;
  source: string;
  variant: string;
  variantLabel: string;
  description: string;
  variants: MapOption[];
  /** Period key and its label. */
  period: string;
  periodLabel: string;
  /** The variant's periods, latest first; `slug` is the period key. */
  periods: MapOption[];
  note?: string;
  /** In drawing order: for points, later ones are drawn on top. */
  places: MapPlace[];
  /** Area each fill takes its value from: itself, or its region. Empty for points. */
  areaPlace: Record<AreaId, string>;
  classes: ColorClass[];
};

/** Aglomerados drawn first, under the others: the GBA partidos surround the city and hide it at country zoom. */
const DRAWN_UNDER = new Set(["33"]);

type BasePlace = { id: string; name: string; lon?: number; lat?: number; labelAt: LabelPoint };

/** Every drawn department, partido or comuna, named with its province since many share a name ("San Martín"). */
const DEPARTMENTS: BasePlace[] = (departmentPlaces as { id: string; name: string; province: string; labelAt: number[] }[]).map(
  ({ id, name, province, labelAt }) => ({ id, name: `${name} (${province})`, labelAt: labelAt as LabelPoint }),
);

function placesOf(geometry: MapGeometry): BasePlace[] {
  if (geometry === "departments") return DEPARTMENTS;
  if (geometry === "areas") return AREAS.map(({ id, name, label }) => ({ id, name, labelAt: label }));
  if (geometry === "regions") return REGIONS.map(({ id, name, label }) => ({ id, name, labelAt: label }));
  return [...AGLOMERADOS]
    .sort((a, b) => Number(DRAWN_UNDER.has(b.code)) - Number(DRAWN_UNDER.has(a.code)))
    .map(({ code, name, lon, lat }) => ({ id: code, name, lon, lat, labelAt: [lon, lat] }));
}

function areaPlaceOf(geometry: MapGeometry): Record<AreaId, string> {
  if (geometry === "aglomerados" || geometry === "departments") return {};
  return Object.fromEntries(AREAS.map((area) => [area.id, geometry === "regions" ? area.region : area.id]));
}

/** The selected period's values joined to their places and colored; null when the variant has no data. */
export function buildMapView({ kpi, variant, period }: MapSelection, data: MapKpiData): MapView | null {
  const periods = data[variant.series]?.periods ?? [];
  const current = periods.find((p) => p.period === period);
  if (!current) return null;

  const joined = placesOf(kpi.geometry).map((place) => {
    const found = current.values[place.id];
    return { ...place, value: found?.value ?? null, ...(found?.cv !== undefined ? { cv: found.cv } : {}), highCv: (found?.cv ?? 0) > HIGH_CV };
  });
  const classes = colorClasses(joined.flatMap((p) => (p.value === null ? [] : [p.value])));
  const unit = variant.unit ?? kpi.unit;

  return {
    kpi: kpi.id,
    label: kpi.label,
    geometry: kpi.geometry,
    unit,
    source: kpi.source,
    variant: variant.slug,
    variantLabel: variant.label,
    description: variant.description,
    variants: kpi.variants.map(({ slug, label }) => ({ slug, label })),
    period: current.period,
    periodLabel: periodLabel(current.period),
    periods: periods.map((p) => ({ slug: p.period, label: periodLabel(p.period) })).reverse(),
    ...(current.note ? { note: current.note } : {}),
    places: joined.map((p) => ({
      ...p,
      color: classColor(classes, p.value),
      label: p.value === null ? null : formatCompact(p.value, unit),
    })),
    areaPlace: areaPlaceOf(kpi.geometry),
    classes,
  };
}

/** Fill color of each area: its own value's color, or its region's. */
export function areaColors(view: MapView): Record<AreaId, string> {
  const colors = new Map(view.places.map((p) => [p.id, p.color]));
  return Object.fromEntries(
    Object.entries(view.areaPlace).map(([area, place]) => [area, colors.get(place) ?? NO_DATA_COLOR]),
  );
}

/** Caveats shown with a value: a high sampling error and the period's note. */
export function placeWarnings(place: Pick<MapPlace, "highCv">, note: string | undefined): string[] {
  return [
    ...(place.highCv ? [`Usar con cuidado: coeficiente de variación mayor al ${HIGH_CV} %`] : []),
    ...(note ? [note] : []),
  ];
}
