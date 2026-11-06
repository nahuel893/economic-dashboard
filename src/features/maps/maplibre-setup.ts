import { setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import { BASEMAP_STYLE_URL, withoutIslandLabels } from "./basemap";

// MapLibre looks for its worker next to its own module, but the bundler moves
// that module into a chunk, so the default path returns the page instead of
// the worker. Pointing at the file lets the bundler emit it as an asset.
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

/** The basemap style, fetched once; on failure MapLibre loads it by URL, keeping the islands' basemap label. */
let basemap: Promise<StyleSpecification | string> | undefined;
export const loadBasemap = () =>
  (basemap ??= fetch(BASEMAP_STYLE_URL)
    .then((response) => (response.ok ? (response.json() as Promise<StyleSpecification>) : Promise.reject()))
    .then(withoutIslandLabels)
    .catch(() => BASEMAP_STYLE_URL));

/** MapLibre's control and gesture texts, in Spanish. */
export const MAP_LOCALE = {
  "CooperativeGesturesHandler.WindowsHelpText": "Usá Ctrl + la rueda del mouse para acercar o alejar el mapa",
  "CooperativeGesturesHandler.MacHelpText": "Usá ⌘ + la rueda del mouse para acercar o alejar el mapa",
  "CooperativeGesturesHandler.MobileHelpText": "Usá dos dedos para mover el mapa",
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
  "NavigationControl.ResetBearing": "Orientar al norte",
  "AttributionControl.ToggleAttribution": "Mostrar u ocultar la atribución",
  "Map.Title": "Mapa",
};

/** Map ink and borders shared by the maps. */
export const MAP_INK = "#0b0b0b";
export const MAP_BORDER = "#77766f";
