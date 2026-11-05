// Builds the static geography the Mapas tab draws, from the official IGN
// boundaries served by georef (datos.gob.ar):
//   public/geo/areas.json     one filled polygon per AreaId in AREAS
//   public/geo/outlines.json  the parts of IGN feature 94 that are not filled,
//                             plus a label point for the Malvinas
//   public/geo/departments.json  one filled polygon per department (partido, comuna), drawn only
//                             by the Census KPI
//   src/lib/sources/snapshots/department-places.json  id, name and a label point inside each
//                             department, so the page does not load the polygons to list them
//
// Run from the repository root (the flag only silences the notice Node prints
// when it loads the typed geography module):
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/geo/build-geo.mjs
// Downloads go to a fresh temporary directory outside the repository; its path
// is printed so it can be inspected or removed. Simplification runs on a pinned
// mapshaper through `pnpm dlx`, so the output is reproducible.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { AREAS, GBA_PARTIDOS } from "../../src/lib/indicators/geography.ts";

const MAPSHAPER = "mapshaper@0.7.101";
const SOURCES = {
  provinces: "https://infra.datos.gob.ar/georef/provincias.geojson",
  departments: "https://infra.datos.gob.ar/georef/departamentos.geojson",
};
const OUT_DIR = resolve("public/geo");
const PLACES_PATH = resolve("src/lib/sources/snapshots/department-places.json");

// Simplification. Filled areas keep ~250 m detail, enough for the GBA
// boundary at city zoom; the unfilled outlines only need country zoom.
const AREAS_INTERVAL = "250m";
const OUTLINES_INTERVAL = "2000m";
const OUTLINES_MIN_AREA = "30km2";
const PRECISION = "0.0001"; // about 11 m
// Departments are only loaded for the Census KPI and are read at province zoom.
const DEPARTMENTS_INTERVAL = "1800m";

// A point inside Isla Grande de Tierra del Fuego (near Tolhuin), to pick it
// among the polygons of IGN feature 94.
const ISLA_GRANDE = [-67.2, -54.5];
// The same, inside the Ushuaia department's part of Isla Grande (the city).
const USHUAIA_ISLA_GRANDE = [-68.3, -54.8];
// Departments left out of the fill: the Antarctic sector and the South Atlantic islands, which areas.json
// and outlines.json draw as outlines (INDEC counts both under 94028).
const UNFILLED_DEPARTMENTS = new Set(["94028", "94021"]);

const normalize = (name) =>
  name.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase();

const polygonsOf = (geometry) => (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates);

function ringContains(ring, [x, y]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bbox(polygon) {
  const xs = polygon[0].map(([x]) => x);
  const ys = polygon[0].map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const unionBbox = (polygons) =>
  polygons.map(bbox).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);

/** Names the parts of feature 94 that are drawn as outlines. */
function outlineName(polygon) {
  const [west, south, east, north] = bbox(polygon);
  if (north < -60) return "Antártida Argentina";
  if (west > -62 && east < -57 && south > -53 && north < -50.8) return "Islas Malvinas";
  if (west > -66 && east < -63 && south > -56 && north < -54) return "Isla de los Estados";
  if (west > -69 && east < -66 && south > -56 && north < -54) return "Islas del canal Beagle";
  return "Islas del Atlántico Sur";
}

const feature = (properties, polygons) => ({
  type: "Feature",
  properties,
  geometry: polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons },
});
const collection = (features) => ({ type: "FeatureCollection", features });

async function download(scratch, name, url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const path = join(scratch, `${name}.geojson`);
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  return JSON.parse(readFileSync(path, "utf8"));
}

function mapshaper(args) {
  execFileSync("pnpm", ["dlx", MAPSHAPER, ...args], { stdio: ["ignore", "inherit", "inherit"] });
}

const areaName = new Map(AREAS.map((area) => [area.id, area.name]));

/** Every province polygon, keyed by AreaId; all of Buenos Aires starts as "06-resto". */
function buildProvincesInput(provinces) {
  const features = [];
  for (const province of provinces.features) {
    const id = province.properties.id === "06" ? "06-resto" : province.properties.id;
    if (id === "94") {
      const isla = polygonsOf(province.geometry).filter((polygon) => ringContains(polygon[0], ISLA_GRANDE));
      if (isla.length !== 1) throw new Error(`Expected one Isla Grande polygon in feature 94, found ${isla.length}`);
      features.push(feature({ id, name: areaName.get(id) }, isla));
      continue;
    }
    if (!areaName.has(id)) throw new Error(`Province ${id} is not in AREAS`);
    features.push(feature({ id, name: areaName.get(id) }, polygonsOf(province.geometry)));
  }
  return collection(features);
}

/** The 24 GBA partidos, matched by name among the departments of Buenos Aires. */
function buildGbaInput(departments) {
  const buenosAires = departments.features.filter((d) => d.properties.provincia.id === "06");
  const properties = { id: "06-gba", name: areaName.get("06-gba") };
  return collection(
    GBA_PARTIDOS.map((partido) => {
      const matches = buenosAires.filter((d) => normalize(d.properties.nombre) === normalize(partido));
      if (matches.length !== 1) throw new Error(`GBA partido "${partido}" matched ${matches.length} georef departments`);
      return feature(properties, polygonsOf(matches[0].geometry));
    }),
  );
}

/** Every department but the unfilled ones; Ushuaia keeps only its part of Isla Grande, not the Beagle and Isla de los Estados islands. */
function buildDepartmentsInput(departments) {
  const features = [];
  for (const { properties, geometry } of departments.features) {
    if (UNFILLED_DEPARTMENTS.has(properties.id)) continue;
    let polygons = polygonsOf(geometry);
    if (properties.id === "94015") {
      polygons = polygons.filter((polygon) => ringContains(polygon[0], USHUAIA_ISLA_GRANDE));
      if (polygons.length !== 1) throw new Error(`Expected one Ushuaia polygon on Isla Grande, found ${polygons.length}`);
    }
    features.push(feature({ id: properties.id, name: properties.nombre }, polygons));
  }
  return collection(features);
}

function buildOutlinesInput(provinces) {
  const tierraDelFuego = provinces.features.find((p) => p.properties.id === "94");
  const groups = new Map();
  for (const polygon of polygonsOf(tierraDelFuego.geometry)) {
    if (ringContains(polygon[0], ISLA_GRANDE)) continue; // filled in areas.json
    const name = outlineName(polygon);
    groups.set(name, [...(groups.get(name) ?? []), polygon]);
  }
  return collection([...groups].map(([name, polygons]) => feature({ name }, polygons)));
}

function addMalvinasLabel(outlinesPath) {
  const outlines = JSON.parse(readFileSync(outlinesPath, "utf8"));
  const malvinas = outlines.features.find((f) => f.properties.name === "Islas Malvinas");
  const [west, south, east, north] = unionBbox(polygonsOf(malvinas.geometry));
  const center = [+((west + east) / 2).toFixed(2), +((south + north) / 2).toFixed(2)];
  outlines.features.push({ type: "Feature", properties: { name: "Islas Malvinas" }, geometry: { type: "Point", coordinates: center } });
  writeFileSync(outlinesPath, JSON.stringify(outlines));
}

/** Writes the label point mapshaper computed for each department next to its id and name. */
function writePlaces(pointsPath) {
  const { features } = JSON.parse(readFileSync(pointsPath, "utf8"));
  const places = features
    .map((f) => ({ id: f.properties.id, name: f.properties.name, labelAt: f.geometry.coordinates }))
    .sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(PLACES_PATH, `${JSON.stringify(places)}\n`);
  console.log(`${PLACES_PATH}: ${places.length} places`);
}

function report(path) {
  const { features } = JSON.parse(readFileSync(path, "utf8"));
  const positions = features.flatMap((f) => (f.geometry.type === "Point" ? [f.geometry.coordinates] : polygonsOf(f.geometry).flat(2)));
  const lons = positions.map(([x]) => x);
  const lats = positions.map(([, y]) => y);
  console.log(
    `${path}: ${(statSync(path).size / 1024).toFixed(1)} KB, ${features.length} features, ${positions.length} positions,`,
    `bounds [${Math.min(...lons)}, ${Math.min(...lats)}] [${Math.max(...lons)}, ${Math.max(...lats)}]`,
  );
}

const scratch = mkdtempSync(join(tmpdir(), "economic-dashboard-geo-"));
console.log(`Scratch directory: ${scratch}`);
const provinces = await download(scratch, "provincias", SOURCES.provinces);
const departments = await download(scratch, "departamentos", SOURCES.departments);

const provincesInput = join(scratch, "provinces-input.geojson");
const gbaInput = join(scratch, "gba-input.geojson");
const outlinesInput = join(scratch, "outlines-input.geojson");
const departmentsInput = join(scratch, "departments-input.geojson");
writeFileSync(provincesInput, JSON.stringify(buildProvincesInput(provinces)));
const gba = buildGbaInput(departments);
writeFileSync(gbaInput, JSON.stringify(gba));
writeFileSync(outlinesInput, JSON.stringify(buildOutlinesInput(provinces)));
writeFileSync(departmentsInput, JSON.stringify(buildDepartmentsInput(departments)));

mkdirSync(OUT_DIR, { recursive: true });
const areasPath = join(OUT_DIR, "areas.json");
const outlinesPath = join(OUT_DIR, "outlines.json");
// georef simplified each boundary on its own, so neighbors leave thin gaps and
// overlaps. "06-resto" is the province outline minus the GBA partidos (not a
// dissolve of its departments, which leaves holes), and -clean closes the
// remaining gaps so shared borders simplify as one line. Erasing leaves small
// slivers of "06-resto" between the partidos and the province coast or CABA;
// those join "06-gba".
const [gbaWest, gbaSouth, gbaEast, gbaNorth] = unionBbox(gba.features.flatMap((f) => polygonsOf(f.geometry)));
const gbaSliver =
  `id == "06-resto" && this.area < 1e7 && this.centroidX > ${gbaWest} && this.centroidX < ${gbaEast}` +
  ` && this.centroidY > ${gbaSouth} && this.centroidY < ${gbaNorth}`;
mapshaper([
  "-i", provincesInput, gbaInput, "combine-files", "snap",
  "-dissolve", "id", "copy-fields=name", "gap-width=500m", "target=gba-input",
  "-erase", "gba-input", "target=provinces-input",
  "-merge-layers", "target=provinces-input,gba-input", "name=areas",
  "-clean", "gap-width=300m",
  "-explode",
  "-each", `if (${gbaSliver}) { id = "06-gba"; name = ${JSON.stringify(areaName.get("06-gba"))}; }`,
  "-dissolve", "id", "copy-fields=name",
  "-simplify", `interval=${AREAS_INTERVAL}`, "keep-shapes",
  "-o", areasPath, "format=geojson", `precision=${PRECISION}`,
]);
mapshaper([
  "-i", outlinesInput,
  "-filter-islands", `min-area=${OUTLINES_MIN_AREA}`, "remove-empty",
  "-simplify", `interval=${OUTLINES_INTERVAL}`, "keep-shapes",
  "-o", outlinesPath, "format=geojson", `precision=${PRECISION}`,
]);
addMalvinasLabel(outlinesPath);

// georef simplified each department on its own, so -clean closes the gaps and overlaps before the shared
// borders simplify as one line. Label points are the "inner" point of each simplified department.
const departmentsPath = join(OUT_DIR, "departments.json");
const labelPointsPath = join(scratch, "department-labels.geojson");
mapshaper([
  "-i", departmentsInput, "snap",
  "-clean", "gap-width=300m",
  "-simplify", `interval=${DEPARTMENTS_INTERVAL}`, "keep-shapes",
  "-o", departmentsPath, "format=geojson", `precision=${PRECISION}`,
]);
mapshaper(["-i", departmentsPath, "-points", "inner", "-o", labelPointsPath, "format=geojson", `precision=${PRECISION}`]);
writePlaces(labelPointsPath);

report(areasPath);
report(outlinesPath);
report(departmentsPath);
