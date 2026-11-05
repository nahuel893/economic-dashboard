import type { ExpressionSpecification, FilterSpecification, StyleSpecification } from "maplibre-gl";

/** OpenFreeMap's light vector style: free, no API key, OpenMapTiles schema. */
export const BASEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/**
 * Names the basemap may give the islands Argentina claims in the South
 * Atlantic; the map draws its own "Islas Malvinas" label instead.
 */
const ISLAND_NAMES = [
  "Falkland Islands",
  "Falkland Islands (Islas Malvinas)",
  "Islas Malvinas",
  "Malvinas",
  "East Falkland",
  "West Falkland",
  "Isla Soledad",
  "Gran Malvina",
  "South Georgia and the South Sandwich Islands",
  "South Georgia",
  "South Sandwich Islands",
  "Islas Georgias del Sur y Sandwich del Sur",
  "Islas Georgias del Sur",
  "Islas Sandwich del Sur",
];

const NAME_KEYS = ["name", "name:latin", "name_en", "name:en", "name:es", "name_int"];

const isIsland: ExpressionSpecification = [
  "any",
  ["==", ["get", "iso_a2"], "FK"],
  ["==", ["get", "iso_a2"], "GS"],
  ...NAME_KEYS.map((key): ExpressionSpecification => ["in", ["coalesce", ["get", key], ""], ["literal", ISLAND_NAMES]]),
];

/** A copy of the style whose place labels skip the islands' names, keeping each layer's own filter. */
export function withoutIslandLabels(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.type !== "symbol" || layer["source-layer"] !== "place") return layer;
      const notIsland: FilterSpecification = ["!", isIsland];
      return { ...layer, filter: layer.filter ? ["all", layer.filter as ExpressionSpecification, notIsland] : notIsland };
    }),
  };
}

/** The first label layer: data layers are inserted before it, so basemap labels stay readable on top. */
export const firstSymbolLayer = (style: StyleSpecification) => style.layers.find((layer) => layer.type === "symbol")?.id;
