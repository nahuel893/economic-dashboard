import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AREAS, MAP_BOUNDS } from "./geography";

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

const positions = (geometry: Geometry): Position[] =>
  geometry.type === "Point"
    ? [geometry.coordinates]
    : geometry.type === "Polygon"
      ? geometry.coordinates.flat()
      : geometry.coordinates.flat(2);
const latitudes = (features: Feature[]) => features.flatMap((f) => positions(f.geometry).map(([, lat]) => lat));
const longitudes = (features: Feature[]) => features.flatMap((f) => positions(f.geometry).map(([lon]) => lon));

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
