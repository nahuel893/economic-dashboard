import { describe, expect, it } from "vitest";
import { formatNumber, formatValue } from "@/lib/format";
import { AGLOMERADOS, AREAS, REGIONS } from "./geography";
import type { MapSeries } from "./map-data";
import {
  areaColors,
  buildMapView,
  classColor,
  colorClasses,
  HIGH_CV,
  MAP_COLORS,
  MAP_KPIS,
  mapHref,
  NO_DATA_COLOR,
  periodLabel,
  placeWarnings,
  resolveMapSelection,
  type MapKpi,
  type MapKpiData,
  type MapVariant,
} from "./maps";

const kpi = (id: string) => MAP_KPIS.find((k) => k.id === id)!;

const series = (periods: MapSeries["periods"]): MapSeries => ({ periods });

const PERIODS: Record<string, string[]> = {
  "salarios/level": ["2026-04", "2026-05", "2026-06"],
  "empleo/yearOnYear": ["2025-Q4", "2026-Q1"],
  "empleo/jobs": ["2026-Q1"],
  "depositos/deposits": ["2025-Q4", "2026-Q1"],
  "depositos/loans": ["2026-Q1"],
  "depositos/ratio": ["2026-Q1"],
  "pobreza/povertyPersons": ["2025-H2", "2026-H1"],
  "pobreza/povertyHouseholds": ["2025-H2", "2026-H1"],
  "pobreza/indigencePersons": ["2026-H1"],
  "pobreza/indigenceHouseholds": ["2026-H1"],
  "inflacion/monthly": ["2026-07", "2026-08"],
  "inflacion/yearOnYear": ["2026-08"],
  "desocupacion/unemployment": ["2026-Q1", "2026-Q2"],
  "actividad/activity": ["2026-Q1", "2026-Q2"],
  "actividad/employment": ["2026-Q2"],
  "exportaciones/total": ["2025-H1", "2026-H1"],
  "exportaciones/yearOnYear": ["2026-H1"],
  "censo/population": ["2022"],
  "censo/density": ["2022"],
};
const periodsOf = (k: MapKpi, v: MapVariant) => PERIODS[`${k.id}/${v.series}`] ?? [];

describe("MAP_KPIS", () => {
  it("offers wages, employment, poverty, inflation, unemployment and labor rates, each on its honest geography", () => {
    expect(MAP_KPIS.map((k) => [k.id, k.geometry, k.unit])).toEqual([
      ["salarios", "areas", "ars"],
      ["empleo", "areas", "percent"],
      ["depositos", "areas", "arsMillions"],
      ["pobreza", "aglomerados", "percent"],
      ["inflacion", "regions", "percent"],
      ["desocupacion", "aglomerados", "percent"],
      ["actividad", "aglomerados", "percent"],
      ["exportaciones", "areas", "usdMillions"],
      ["censo", "departments", "count"],
    ]);
  });

  it("offers the census population first, then the density, with no NBI since INDEC publishes none by department", () => {
    expect(kpi("censo").variants.map((v) => [v.slug, v.series, v.unit])).toEqual([
      ["poblacion", "population", undefined],
      ["densidad", "density", "perKm2"],
    ]);
    expect(kpi("censo").source).toBe("INDEC, Censo 2022");
  });

  it("lists poverty variants with % of persons first, and inflation monthly then year-on-year", () => {
    expect(kpi("pobreza").variants.map((v) => v.slug)).toEqual([
      "personas",
      "hogares",
      "indigencia-personas",
      "indigencia-hogares",
    ]);
    expect(kpi("inflacion").variants.map((v) => v.slug)).toEqual(["mensual", "interanual"]);
    expect(kpi("empleo").variants.map((v) => v.slug)).toEqual(["variacion", "puestos"]);
    expect(kpi("salarios").variants).toHaveLength(1);
    expect(kpi("desocupacion").variants).toHaveLength(1);
    expect(kpi("actividad").variants.map((v) => v.slug)).toEqual(["actividad", "empleo"]);
    expect(kpi("exportaciones").variants.map((v) => [v.slug, v.unit])).toEqual([
      ["total", undefined],
      ["variacion", "percent"],
    ]);
  });

  it("cites each source by its short name", () => {
    expect(MAP_KPIS.map((k) => k.source)).toEqual(["OEDE (SIPA)", "OEDE (SIPA)", "BCRA", "INDEC, EPH", "INDEC vía datos.gob.ar", "INDEC, EPH", "INDEC, EPH", "INDEC, OPEX", "INDEC, Censo 2022"]);
  });
});

describe("resolveMapSelection", () => {
  const resolve = (params: Parameters<typeof resolveMapSelection>[0]) => {
    const s = resolveMapSelection(params, periodsOf);
    return [s.kpi.id, s.variant.slug, s.period];
  };

  it("defaults to the first KPI, its default variant and its latest period", () => {
    expect(resolve({})).toEqual(["salarios", "promedio", "2026-06"]);
  });

  it("reads the KPI, variant and period from their Spanish slugs", () => {
    expect(resolve({ kpi: "pobreza", valor: "hogares", periodo: "2025-s2" })).toEqual(["pobreza", "hogares", "2025-H2"]);
    expect(resolve({ kpi: "desocupacion", periodo: "2026-t1" })).toEqual(["desocupacion", "tasa", "2026-Q1"]);
    expect(resolve({ kpi: "salarios", periodo: "2026-05" })).toEqual(["salarios", "promedio", "2026-05"]);
    expect(resolve({ kpi: "actividad" })).toEqual(["actividad", "actividad", "2026-Q2"]);
    expect(resolve({ kpi: "actividad", valor: "empleo", periodo: "2026-t1" })).toEqual(["actividad", "empleo", "2026-Q2"]);
  });

  it("resolves employment to the year-on-year change by default and to the jobs on request", () => {
    expect(resolve({ kpi: "empleo" })).toEqual(["empleo", "variacion", "2026-Q1"]);
    expect(resolve({ kpi: "empleo", valor: "puestos", periodo: "2026-t1" })).toEqual(["empleo", "puestos", "2026-Q1"]);
    expect(mapHref("empleo", "puestos", "2026-Q1")).toBe("/mapas?kpi=empleo&valor=puestos&periodo=2026-t1");
  });

  it("resolves deposits and loans to deposits by default, with loans and the loans-to-deposits ratio on request", () => {
    expect(resolve({ kpi: "depositos" })).toEqual(["depositos", "depositos", "2026-Q1"]);
    expect(resolve({ kpi: "depositos", valor: "prestamos" })).toEqual(["depositos", "prestamos", "2026-Q1"]);
    expect(resolve({ kpi: "depositos", valor: "relacion", periodo: "2026-t1" })).toEqual(["depositos", "relacion", "2026-Q1"]);
    expect(kpi("depositos").variants.map((v) => [v.slug, v.unit ?? kpi("depositos").unit])).toEqual([
      ["depositos", "arsMillions"],
      ["prestamos", "arsMillions"],
      ["relacion", "percent"],
    ]);
    expect(mapHref("depositos", "relacion", "2026-Q1")).toBe("/mapas?kpi=depositos&valor=relacion&periodo=2026-t1");
  });

  it("falls back on unknown or missing values instead of failing", () => {
    expect(resolve({ kpi: "pbi", valor: "x", periodo: "nunca" })).toEqual(["salarios", "promedio", "2026-06"]);
    expect(resolve({ kpi: "inflacion", valor: "trimestral" })).toEqual(["inflacion", "mensual", "2026-08"]);
    // The variant has no such period: its latest one.
    expect(resolve({ kpi: "inflacion", valor: "interanual", periodo: "2026-07" })).toEqual(["inflacion", "interanual", "2026-08"]);
    expect(resolve({ kpi: "pobreza", periodo: "2026-06" })).toEqual(["pobreza", "personas", "2026-H1"]);
  });

  it("has no period when the KPI has no data", () => {
    expect(resolveMapSelection({ kpi: "pobreza" }, () => []).period).toBeNull();
  });
});

describe("mapHref", () => {
  it("builds the URL with Spanish slugs", () => {
    expect(mapHref("pobreza", "hogares", "2026-H1")).toBe("/mapas?kpi=pobreza&valor=hogares&periodo=2026-s1");
    expect(mapHref("desocupacion", "tasa", "2026-Q2")).toBe("/mapas?kpi=desocupacion&valor=tasa&periodo=2026-t2");
    expect(mapHref("actividad", "empleo", "2026-Q2")).toBe("/mapas?kpi=actividad&valor=empleo&periodo=2026-t2");
    expect(mapHref("salarios", "promedio", "2026-06")).toBe("/mapas?kpi=salarios&valor=promedio&periodo=2026-06");
  });

  it("leaves out the variant and period to reset to their defaults", () => {
    expect(mapHref("inflacion")).toBe("/mapas?kpi=inflacion");
  });
});

describe("periodLabel", () => {
  it("names months, quarters and half-years in Spanish", () => {
    expect(periodLabel("2026-06")).toBe("junio de 2026");
    expect(periodLabel("2026-H1")).toBe("1.er semestre de 2026");
    expect(periodLabel("2025-H2")).toBe("2.º semestre de 2025");
    expect(periodLabel("2026-Q1")).toBe("1.er trimestre de 2026");
    expect(periodLabel("2026-Q2")).toBe("2.º trimestre de 2026");
    expect(periodLabel("2026-Q3")).toBe("3.er trimestre de 2026");
    expect(periodLabel("2026-Q4")).toBe("4.º trimestre de 2026");
  });

  it("names a census year as the year itself", () => {
    expect(periodLabel("2022")).toBe("2022");
  });
});

describe("colorClasses", () => {
  it("splits the values into five quantile classes, light to dark", () => {
    const classes = colorClasses([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(classes).toEqual([
      { color: MAP_COLORS[0], from: 1, to: 2 },
      { color: MAP_COLORS[1], from: 3, to: 4 },
      { color: MAP_COLORS[2], from: 5, to: 6 },
      { color: MAP_COLORS[3], from: 7, to: 8 },
      { color: MAP_COLORS[4], from: 9, to: 10 },
    ]);
  });

  it("uses fewer classes, spread over the scale, when there are fewer distinct values", () => {
    expect(colorClasses([4, 2, 4])).toEqual([
      { color: MAP_COLORS[0], from: 2, to: 2 },
      { color: MAP_COLORS[4], from: 4, to: 4 },
    ]);
    expect(colorClasses([3])).toEqual([{ color: MAP_COLORS[2], from: 3, to: 3 }]);
    expect(colorClasses([])).toEqual([]);
  });

  it("colors a value by its class, and missing values gray", () => {
    const classes = colorClasses([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(classColor(classes, 1)).toBe(MAP_COLORS[0]);
    expect(classColor(classes, 6)).toBe(MAP_COLORS[2]);
    expect(classColor(classes, 10)).toBe(MAP_COLORS[4]);
    expect(classColor(classes, null)).toBe(NO_DATA_COLOR);
  });
});

describe("buildMapView", () => {
  const wages: MapKpiData = {
    level: series([
      { period: "2026-05", values: { "02": { value: 100 }, "14": { value: 50 } } },
      { period: "2026-06", values: { "02": { value: 150 }, "14": { value: 75 } }, note: "Incluye aguinaldo" },
    ]),
  };

  it("formats employment as a % change by default and as a plain count for the jobs", () => {
    const employment: MapKpiData = {
      yearOnYear: series([{ period: "2026-Q1", values: { "02": { value: -1.5 } } }]),
      jobs: series([{ period: "2026-Q1", values: { "02": { value: 1234567 } } }]),
    };
    const unitOf = (valor?: string) => buildMapView(resolveMapSelection({ kpi: "empleo", valor }, periodsOf), employment)!.unit;
    expect(unitOf()).toBe("percent");
    expect(unitOf("puestos")).toBe("count");
    expect(formatValue(1234567, "count")).toBe(formatNumber(1234567));
  });

  it("labels each place with its short value at its label point, and no label without data", () => {
    const view = buildMapView(resolveMapSelection({ kpi: "salarios" }, periodsOf), {
      level: series([{ period: "2026-06", values: { "02": { value: 2_761_629 } } }]),
    })!;
    const city = view.places.find((p) => p.id === "02")!;
    expect(city.label).toBe("$ 2,76 M");
    expect(city.labelAt).toEqual(AREAS.find((a) => a.id === "02")!.label);
    expect(view.places.find((p) => p.id === "94")!.label).toBeNull();
  });

  it("labels peso amounts in millions with the long-scale short form", () => {
    const view = buildMapView(resolveMapSelection({ kpi: "depositos" }, periodsOf), {
      deposits: series([{ period: "2026-Q1", values: { "02": { value: 98_221_865 }, "94": { value: 234_000 } } }]),
    })!;
    expect(view.places.find((p) => p.id === "02")!.label).toBe("$ 98,2 B");
    expect(view.places.find((p) => p.id === "94")!.label).toBe("$ 234 mil M");
  });

  it("shows exports in millions of USD by default, labeled whole, and the year-on-year change as a %", () => {
    const exportsData: MapKpiData = {
      total: series([{ period: "2026-H1", values: { "14": { value: 5601.31 }, "58": { value: 18.26 } } }]),
      yearOnYear: series([{ period: "2026-H1", values: { "14": { value: 9.3 } } }]),
    };
    const view = (valor?: string) => buildMapView(resolveMapSelection({ kpi: "exportaciones", valor }, periodsOf), exportsData)!;
    expect(view().unit).toBe("usdMillions");
    expect(view().periodLabel).toBe("1.er semestre de 2026");
    expect(view().places.find((p) => p.id === "14")!.label?.replace(/\s/g, " ")).toBe("US$ 5.601 M");
    expect(view("variacion").unit).toBe("percent");
    expect(view("variacion").places.find((p) => p.id === "14")!.label).toBe("9,3 %");
    expect(view("variacion").places.find((p) => p.id === "58")!.label).toBeNull();
    expect(mapHref("exportaciones", "variacion", "2026-H1")).toBe("/mapas?kpi=exportaciones&valor=variacion&periodo=2026-s1");
  });

  it("labels regions at the region's label point and aglomerados at their own point", () => {
    const inflation = buildMapView(resolveMapSelection({ kpi: "inflacion" }, periodsOf), {
      monthly: series([{ period: "2026-08", values: { Cuyo: { value: 2.34 } } }]),
      yearOnYear: series([{ period: "2026-08", values: { Cuyo: { value: 33.4 } } }]),
    })!;
    expect(inflation.places.find((p) => p.id === "Cuyo")).toMatchObject({
      label: expect.stringMatching(/ %$/),
      labelAt: REGIONS.find((r) => r.id === "Cuyo")!.label,
    });
    const unemployment = buildMapView(resolveMapSelection({ kpi: "desocupacion" }, periodsOf), {
      unemployment: series([{ period: "2026-Q2", values: { "13": { value: 9.2 } } }]),
    })!;
    const cordoba = AGLOMERADOS.find((a) => a.code === "13")!;
    expect(unemployment.places.find((p) => p.id === "13")).toMatchObject({ label: "9,2 %", labelAt: [cordoba.lon, cordoba.lat] });
  });

  it("joins the period's values to every area, with no-data areas gray", () => {
    const view = buildMapView(resolveMapSelection({ kpi: "salarios" }, periodsOf), wages)!;
    expect(view.places).toHaveLength(AREAS.length);
    expect(view.places.find((p) => p.id === "02")).toMatchObject({ name: "Ciudad Autónoma de Buenos Aires", value: 150 });
    expect(view.places.find((p) => p.id === "94")).toMatchObject({ value: null, color: NO_DATA_COLOR });
    expect(view.note).toBe("Incluye aguinaldo");
    expect(view.periodLabel).toBe("junio de 2026");
    expect(view.periods.map((p) => p.slug)).toEqual(["2026-06", "2026-05"]);
    expect(view.classes.map((c) => [c.from, c.to])).toEqual([
      [75, 75],
      [150, 150],
    ]);
    expect(areaColors(view)["02"]).toBe(MAP_COLORS[4]);
    expect(areaColors(view)["94"]).toBe(NO_DATA_COLOR);
  });

  it("colors each area with its region's value for inflation", () => {
    const values = Object.fromEntries(REGIONS.map((r, i) => [r.id, { value: i + 1 }]));
    const data: MapKpiData = { monthly: series([{ period: "2026-08", values }]), yearOnYear: series([]) };
    const view = buildMapView(resolveMapSelection({ kpi: "inflacion" }, periodsOf), data)!;
    expect(view.places.map((p) => p.id)).toEqual(REGIONS.map((r) => r.id));
    const colors = areaColors(view);
    for (const area of AREAS) expect(colors[area.id]).toBe(view.places.find((p) => p.id === area.region)!.color);
    expect(view.areaPlace["06-gba"]).toBe("GBA");
    expect(view.areaPlace["06-resto"]).toBe("Pampeana");
  });

  it("draws aglomerados as points, with the GBA partidos under the city and high CVs flagged", () => {
    const data: MapKpiData = {
      povertyPersons: series([
        { period: "2026-H1", values: { "32": { value: 15, cv: 10 }, "33": { value: 35, cv: 16 }, "2": { value: 30, cv: 16.5 } } },
      ]),
    };
    const view = buildMapView(resolveMapSelection({ kpi: "pobreza" }, () => ["2026-H1"]), data)!;
    expect(view.places).toHaveLength(AGLOMERADOS.length);
    const ids = view.places.map((p) => p.id);
    expect(ids.indexOf("33")).toBeLessThan(ids.indexOf("32"));
    expect(view.places.find((p) => p.id === "2")).toMatchObject({ value: 30, cv: 16.5, highCv: true, lon: -57.95, lat: -34.92 });
    expect(view.places.find((p) => p.id === "33")).toMatchObject({ highCv: false });
    expect(view.areaPlace).toEqual({});
    expect(areaColors(view)).toEqual({});
  });

  it("draws the census on one place per department, labeled inside it, with no area fills to color", () => {
    const census: MapKpiData = {
      population: series([{ period: "2022", values: { "06028": { value: 584_827 }, "02007": { value: 223_554 } } }]),
      density: series([{ period: "2022", values: { "06028": { value: 4523 } } }]),
    };
    const view = buildMapView(resolveMapSelection({ kpi: "censo" }, periodsOf), census)!;
    expect(view.geometry).toBe("departments");
    expect(view.places).toHaveLength(527);
    expect(view.places.find((p) => p.id === "06028")).toMatchObject({
      name: "Almirante Brown (Buenos Aires)",
      value: 584_827,
      label: "585 mil",
      labelAt: expect.any(Array),
    });
    expect(view.places.find((p) => p.id === "94015")).toMatchObject({ name: "Ushuaia (Tierra del Fuego)", value: null, label: null });
    expect(view.areaPlace).toEqual({});
    expect(view.periodLabel).toBe("2022");
    const density = buildMapView(resolveMapSelection({ kpi: "censo", valor: "densidad" }, periodsOf), census)!;
    expect(density.unit).toBe("perKm2");
    expect(density.places.find((p) => p.id === "06028")!.label).toBe("4,52 mil");
  });

  it("keeps the province view of the other KPIs free of departments", () => {
    const view = buildMapView(resolveMapSelection({ kpi: "salarios" }, periodsOf), wages)!;
    expect(view.places).toHaveLength(AREAS.length);
    expect(Object.keys(view.areaPlace)).toHaveLength(AREAS.length);
  });

  it("is null when the selection has no period", () => {
    expect(buildMapView(resolveMapSelection({ kpi: "salarios" }, () => []), wages)).toBeNull();
  });
});

describe("placeWarnings", () => {
  it("warns about high CVs and the period note", () => {
    expect(HIGH_CV).toBe(16);
    expect(placeWarnings({ highCv: true }, "Incluye aguinaldo")).toEqual([
      "Usar con cuidado: coeficiente de variación mayor al 16 %",
      "Incluye aguinaldo",
    ]);
    expect(placeWarnings({ highCv: false }, undefined)).toEqual([]);
  });
});
