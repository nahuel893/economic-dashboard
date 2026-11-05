/**
 * Places the Mapas tab draws data on: provinces (INDEC codes), the six INDEC
 * regions, and the EPH urban areas (aglomerados). Pure data, shared by the
 * source adapters (to key their values) and the map (to draw them).
 */

export type RegionId = "GBA" | "Pampeana" | "NOA" | "NEA" | "Cuyo" | "Patagonia";

export const REGIONS: { id: RegionId; name: string }[] = [
  { id: "GBA", name: "Gran Buenos Aires" },
  { id: "Pampeana", name: "Pampeana" },
  { id: "NOA", name: "Noroeste" },
  { id: "NEA", name: "Noreste" },
  { id: "Cuyo", name: "Cuyo" },
  { id: "Patagonia", name: "Patagonia" },
];

/**
 * Map areas: the INDEC province code, except Buenos Aires province, which is
 * split like INDEC and OEDE split it: "06-gba" is the 24 partidos around the
 * city and "06-resto" the rest of the province.
 */
export type AreaId = string;

export type Area = { id: AreaId; name: string; province: string; region: RegionId };

export const AREAS: Area[] = [
  { id: "02", name: "Ciudad Autónoma de Buenos Aires", province: "02", region: "GBA" },
  { id: "06-gba", name: "Partidos del Gran Buenos Aires", province: "06", region: "GBA" },
  { id: "06-resto", name: "Resto de Buenos Aires", province: "06", region: "Pampeana" },
  { id: "10", name: "Catamarca", province: "10", region: "NOA" },
  { id: "14", name: "Córdoba", province: "14", region: "Pampeana" },
  { id: "18", name: "Corrientes", province: "18", region: "NEA" },
  { id: "22", name: "Chaco", province: "22", region: "NEA" },
  { id: "26", name: "Chubut", province: "26", region: "Patagonia" },
  { id: "30", name: "Entre Ríos", province: "30", region: "Pampeana" },
  { id: "34", name: "Formosa", province: "34", region: "NEA" },
  { id: "38", name: "Jujuy", province: "38", region: "NOA" },
  { id: "42", name: "La Pampa", province: "42", region: "Pampeana" },
  { id: "46", name: "La Rioja", province: "46", region: "NOA" },
  { id: "50", name: "Mendoza", province: "50", region: "Cuyo" },
  { id: "54", name: "Misiones", province: "54", region: "NEA" },
  { id: "58", name: "Neuquén", province: "58", region: "Patagonia" },
  { id: "62", name: "Río Negro", province: "62", region: "Patagonia" },
  { id: "66", name: "Salta", province: "66", region: "NOA" },
  { id: "70", name: "San Juan", province: "70", region: "Cuyo" },
  { id: "74", name: "San Luis", province: "74", region: "Cuyo" },
  { id: "78", name: "Santa Cruz", province: "78", region: "Patagonia" },
  { id: "82", name: "Santa Fe", province: "82", region: "Pampeana" },
  { id: "86", name: "Santiago del Estero", province: "86", region: "NOA" },
  { id: "90", name: "Tucumán", province: "90", region: "NOA" },
  { id: "94", name: "Tierra del Fuego", province: "94", region: "Patagonia" },
];

/**
 * First view of the map, as [[west, south], [east, north]]: mainland Argentina,
 * Isla Grande de Tierra del Fuego and the Malvinas, never the Antarctic sector.
 * Rounded outward from the bounds of public/geo/areas.json.
 */
export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [-73.6, -55.1],
  [-53.6, -21.7],
];

/** The 24 partidos INDEC counts as Gran Buenos Aires, as named by georef. */
export const GBA_PARTIDOS = [
  "Almirante Brown",
  "Avellaneda",
  "Berazategui",
  "Esteban Echeverría",
  "Ezeiza",
  "Florencio Varela",
  "General San Martín",
  "Hurlingham",
  "Ituzaingó",
  "José C. Paz",
  "La Matanza",
  "Lanús",
  "Lomas de Zamora",
  "Malvinas Argentinas",
  "Merlo",
  "Moreno",
  "Morón",
  "Quilmes",
  "San Fernando",
  "San Isidro",
  "San Miguel",
  "Tigre",
  "Tres de Febrero",
  "Vicente López",
];

/** EPH urban area, keyed by its EPH code. Coordinates are the main city's center. */
export type Aglomerado = { code: string; name: string; region: RegionId; lon: number; lat: number };

export const AGLOMERADOS: Aglomerado[] = [
  { code: "2", name: "Gran La Plata", region: "Pampeana", lon: -57.95, lat: -34.92 },
  { code: "3", name: "Bahía Blanca - Cerri", region: "Pampeana", lon: -62.27, lat: -38.72 },
  { code: "4", name: "Gran Rosario", region: "Pampeana", lon: -60.64, lat: -32.95 },
  { code: "5", name: "Gran Santa Fe", region: "Pampeana", lon: -60.7, lat: -31.63 },
  { code: "6", name: "Gran Paraná", region: "Pampeana", lon: -60.53, lat: -31.73 },
  { code: "7", name: "Posadas", region: "NEA", lon: -55.9, lat: -27.37 },
  { code: "8", name: "Gran Resistencia", region: "NEA", lon: -58.99, lat: -27.46 },
  { code: "9", name: "Comodoro Rivadavia - Rada Tilly", region: "Patagonia", lon: -67.5, lat: -45.86 },
  { code: "10", name: "Gran Mendoza", region: "Cuyo", lon: -68.84, lat: -32.89 },
  { code: "12", name: "Corrientes", region: "NEA", lon: -58.83, lat: -27.47 },
  { code: "13", name: "Gran Córdoba", region: "Pampeana", lon: -64.18, lat: -31.42 },
  { code: "14", name: "Concordia", region: "Pampeana", lon: -58.02, lat: -31.39 },
  { code: "15", name: "Formosa", region: "NEA", lon: -58.18, lat: -26.18 },
  { code: "17", name: "Neuquén - Plottier", region: "Patagonia", lon: -68.06, lat: -38.95 },
  { code: "18", name: "Santiago del Estero - La Banda", region: "NOA", lon: -64.26, lat: -27.79 },
  { code: "19", name: "Jujuy - Palpalá", region: "NOA", lon: -65.3, lat: -24.19 },
  { code: "20", name: "Río Gallegos", region: "Patagonia", lon: -69.22, lat: -51.62 },
  { code: "22", name: "Gran Catamarca", region: "NOA", lon: -65.78, lat: -28.47 },
  { code: "23", name: "Gran Salta", region: "NOA", lon: -65.41, lat: -24.79 },
  { code: "25", name: "La Rioja", region: "NOA", lon: -66.86, lat: -29.41 },
  { code: "26", name: "Gran San Luis", region: "Cuyo", lon: -66.34, lat: -33.3 },
  { code: "27", name: "Gran San Juan", region: "Cuyo", lon: -68.54, lat: -31.54 },
  { code: "29", name: "Gran Tucumán - Tafí Viejo", region: "NOA", lon: -65.22, lat: -26.82 },
  { code: "30", name: "Santa Rosa - Toay", region: "Pampeana", lon: -64.29, lat: -36.62 },
  { code: "31", name: "Ushuaia - Río Grande", region: "Patagonia", lon: -68.3, lat: -54.8 },
  { code: "32", name: "Ciudad Autónoma de Buenos Aires", region: "GBA", lon: -58.44, lat: -34.61 },
  { code: "33", name: "Partidos del GBA", region: "GBA", lon: -58.55, lat: -34.7 },
  { code: "34", name: "Mar del Plata", region: "Pampeana", lon: -57.56, lat: -38.0 },
  { code: "36", name: "Río Cuarto", region: "Pampeana", lon: -64.35, lat: -33.12 },
  { code: "38", name: "San Nicolás - Villa Constitución", region: "Pampeana", lon: -60.22, lat: -33.33 },
  { code: "91", name: "Rawson - Trelew", region: "Patagonia", lon: -65.3, lat: -43.25 },
  { code: "93", name: "Viedma - Carmen de Patagones", region: "Patagonia", lon: -62.99, lat: -40.81 },
];
