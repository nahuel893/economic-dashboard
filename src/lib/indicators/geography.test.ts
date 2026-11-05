import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AREAS, MAP_BOUNDS, PROVINCES, REGIONS } from "./geography";

type Position = [number, number];
type Geometry =
  | { type: "Point"; coordinates: Position }
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };
type Feature = { properties: Record<string, string>; geometry: Geometry };

const GEO_DIR = join(process.cwd(), "public", "geo");
const readFeatures = (file: string): Feature[] => JSON.parse(readFileSync(join(GEO_DIR, file), "utf8")).features;
const areas = readFeatures("areas.json");
const outlines = readFeatures("outlines.json");
const departments = readFeatures("departments.json");
const departmentPlaces: { id: string; name: string; labelAt: Position }[] = JSON.parse(
  readFileSync(join(process.cwd(), "src", "lib", "sources", "snapshots", "department-places.json"), "utf8"),
);

const positions = (geometry: Geometry): Position[] =>
  geometry.type === "Point"
    ? [geometry.coordinates]
    : geometry.type === "Polygon"
      ? geometry.coordinates.flat()
      : geometry.coordinates.flat(2);
const latitudes = (features: Feature[]) => features.flatMap((f) => positions(f.geometry).map(([, lat]) => lat));
const longitudes = (features: Feature[]) => features.flatMap((f) => positions(f.geometry).map(([lon]) => lon));

/** Ray casting over every ring: inside an odd number of rings means inside the area (holes count as rings). */
function contains(geometry: Geometry, [x, y]: Position): boolean {
  if (geometry.type === "Point") return false;
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const areaGeometry = (id: string) => areas.find((f) => f.properties.id === id)!.geometry;

describe("PROVINCES", () => {
  it("lists every province once, with Buenos Aires whole and labeled where its rest of the province is", () => {
    expect(PROVINCES).toHaveLength(24);
    expect(new Set(PROVINCES.map((p) => p.id)).size).toBe(24);
    expect(PROVINCES.find((p) => p.id === "06")).toEqual({
      id: "06",
      name: "Buenos Aires",
      label: AREAS.find((a) => a.id === "06-resto")!.label,
    });
    expect(PROVINCES.find((p) => p.id === "14")).toEqual({ id: "14", name: "Córdoba", label: AREAS.find((a) => a.id === "14")!.label });
  });
});

describe("label points", () => {
  it("puts each area's label inside that area", () => {
    for (const area of AREAS) expect(contains(areaGeometry(area.id), area.label), area.id).toBe(true);
  });

  it("puts each region's label inside one of its areas", () => {
    for (const region of REGIONS) {
      const own = AREAS.filter((a) => a.region === region.id);
      expect(own.some((a) => contains(areaGeometry(a.id), region.label)), region.id).toBe(true);
    }
  });
});

describe("areas.json", () => {
  it("has exactly one polygon feature per map area, named like AREAS", () => {
    expect(areas.map((f) => f.properties.id).sort()).toEqual(AREAS.map((a) => a.id).sort());
    for (const feature of areas) {
      expect(["Polygon", "MultiPolygon"]).toContain(feature.geometry.type);
      expect(feature.properties.name).toBe(AREAS.find((a) => a.id === feature.properties.id)!.name);
    }
  });

  it("fills only Isla Grande de Tierra del Fuego for province 94", () => {
    const lats = latitudes(areas.filter((f) => f.properties.id === "94"));
    expect(Math.min(...lats)).toBeGreaterThan(-55.2);
    expect(Math.max(...lats)).toBeLessThan(-52.4);
  });
});

describe("outlines.json", () => {
  it("draws the Malvinas, the Antarctic sector and a label point for the Malvinas", () => {
    const polygons = outlines.filter((f) => f.geometry.type !== "Point");
    expect(polygons.map((f) => f.properties.name)).toContain("Islas Malvinas");
    const antarctic = polygons.find((f) => f.properties.name === "Antártida Argentina");
    expect(Math.max(...latitudes([antarctic!]))).toBeLessThan(-60);
    const labels = outlines.filter((f) => f.geometry.type === "Point");
    expect(labels.map((f) => f.properties.name)).toEqual(["Islas Malvinas"]);
  });
});

describe("MAP_BOUNDS", () => {
  const [[west, south], [east, north]] = MAP_BOUNDS;

  it("frames every filled area and the Malvinas, never the Antarctic sector", () => {
    const framed = [...areas, ...outlines.filter((f) => f.properties.name === "Islas Malvinas")];
    expect(west).toBeLessThanOrEqual(Math.min(...longitudes(framed)));
    expect(east).toBeGreaterThanOrEqual(Math.max(...longitudes(framed)));
    expect(south).toBeLessThanOrEqual(Math.min(...latitudes(framed)));
    expect(north).toBeGreaterThanOrEqual(Math.max(...latitudes(framed)));
    expect(south).toBeGreaterThan(-56);
  });
});

it("keeps both geography files within about 200 KB together", () => {
  const bytes = ["areas.json", "outlines.json"].reduce((sum, file) => sum + statSync(join(GEO_DIR, file)).size, 0);
  expect(bytes).toBeLessThanOrEqual(200 * 1024);
});

describe("departments.json", () => {
  it("has one polygon per georef department, without the Antarctic sector and the South Atlantic islands", () => {
    const ids = departments.map((f) => f.properties.id);
    expect(ids).toHaveLength(527);
    expect(new Set(ids).size).toBe(527);
    expect(ids).not.toContain("94028");
    expect(ids).not.toContain("94021");
    for (const feature of departments) {
      expect(feature.properties.id).toMatch(/^\d{5}$/);
      expect(["Polygon", "MultiPolygon"]).toContain(feature.geometry.type);
    }
  });

  it("fills only Isla Grande for the Tierra del Fuego departments", () => {
    const lats = latitudes(departments.filter((f) => f.properties.id.startsWith("94")));
    expect(Math.min(...lats)).toBeGreaterThan(-55.2);
    expect(Math.max(...lats)).toBeLessThan(-52.4);
    expect(Math.max(...longitudes(departments.filter((f) => f.properties.id.startsWith("94"))))).toBeLessThan(-65);
  });

  it("puts each department's label inside that department", () => {
    expect(departmentPlaces.map((p) => p.id).sort()).toEqual(departments.map((f) => f.properties.id).sort());
    for (const place of departmentPlaces) {
      const feature = departments.find((f) => f.properties.id === place.id)!;
      expect(feature.properties.name, place.id).toBe(place.name);
      expect(contains(feature.geometry, place.labelAt), place.id).toBe(true);
    }
  });

  it("stays within about 400 KB", () => {
    expect(statSync(join(GEO_DIR, "departments.json")).size).toBeLessThanOrEqual(400 * 1024);
  });
});
