# Mapas tab: design

Date: 2026-11-05. Status: draft for the user's approval. The user approved the playback, including its "(my call)" items, with "dale metele".

Marks: **(user)** means the user decided it in conversation. **(my call)** means a default I chose that the user has not confirmed. The rest is a constraint from the data or the code.

## Intent

A fourth tab, **Mapas**, shows where things happen in Argentina: one map, a KPI selector, and each place colored by its value. The user's first questions are poverty ("niveles de pobreza en distintos valores, porcentajes, por provincia") and wages ("promedio de sueldos por provincia"). Later the user wants to see which of the dashboard's existing KPIs can be split by geography.

Success means opening the tab and immediately seeing which provinces or cities are better or worse on a KPI, at its latest data. Every value must be honest about what the source measures: its geographic unit, its period and its error.

## Goals

- **One map with selectable KPIs (user).** No grid of small maps.
- **Navigable basemap (user).** Use MapLibre GL through `react-map-gl/maplibre`, without 3D. Most of the time the user looks at province or department level (user).
- **Light basemap (user).** OpenFreeMap's light vector style (Positron), free and with no API key (user picked OpenFreeMap "por el momento"). The rest of the site stays dark and the map is a light sheet inside it (my call). The basemap must be swappable later, for example for IGN's Argenmap, without touching the data layers.
- **Latest data by default, period selectable (user).** Each KPI offers its own periods: months, quarters or half-years. Switching KPI jumps to that KPI's latest period (my call). KPI, value variant and period live in the URL so a view can be shared, like Histórico (my call).
- **Hover or tap** shows the place, value, period and short source. A legend shows the color scale. The page footer has detailed source references, like the other tabs.
- **Accessible table view (my call).** Below the map, a table lists the same values by place, sortable by value. It is the reading path for screen readers, and it is useful on small phones.

## Non-goals

- No 3D, no extrusion, no globe.
- No density heat map ("mapa de calor" as blurred spots). No source has point-level data; the finest is Census 2022 by department. Choropleths are the honest "heat" view.
- No coparticipación: no stable download URL was found.
- No IGN basemap in v1.

## Anti-goals (would be a failure even if it works)

- Showing poverty or unemployment painted on provinces. INDEC publishes them only for 31 urban aglomerados and 6 regions, never per province.
- Hiding sampling error. Aglomerado values with a high coefficient of variation must be visibly flagged. INDEC's poverty tables mark them as "usar con cuidado" (CV around 16–25 %).
- Comparing wage months with and without aguinaldo without saying so. June and December include it, which makes June about 1.5× May.
- Breaking page scroll. A wheel or one-finger drag must never be captured by accident. This follows the spirit of chart zoom rule S6 in `odd/tasks/chart-zoom.md`. S6 governs charts. The map is navigable by the user's choice, so a two-finger pinch over it zooms the map (my call). On phones the map takes at most about 60 % of the viewport height, so the page can still be pinched and scrolled outside it.

## KPIs in v1

| KPI | Unit on the map | Values | Periods | Source |
|---|---|---|---|---|
| Average registered private wage | Province; Buenos Aires province is split into GBA partidos and the rest (see Geography) | Pesos, nominal | Monthly | OEDE/SIPA, Ministerio de Capital Humano |
| Poverty and indigence (user) | 31 EPH aglomerados as points | % of persons (default), % of households, indigence % of persons, indigence % of households | Half-yearly | INDEC, EPH poverty report |
| Inflation (my call: already in the dashboard, cleanest automation) | 6 IPC regions, drawn by filling their provinces and partidos | Monthly %, year-on-year % | Monthly | INDEC IPC via the datos.gob.ar series API |
| Unemployment (my call: drawn like poverty) | 31 EPH aglomerados as points | Unemployment rate (activity and employment rates are left to the builder) | Quarterly | INDEC, EPH labor market |

**If a v1 source fails verification (my call):** inflation and unemployment were added by me, so the first build step verifies their sources. A KPI whose source cannot be fetched reliably moves to "later" instead of blocking v1. Wages and poverty are the user's and stay in v1.

These come later, with the same mechanics: registered employment by province (OEDE), deposits and loans per capita by province (BCRA `vol4_ser.txt`, quarterly), exports by province (INDEC OPEX, half-yearly), and Census 2022 by department (population, density, growth since 2010, NBI).

The wage value is the level in pesos (my call). A year-on-year value variant is a cheap later addition.

## Data sources (researched 2026-11-04)

"Verified" means the file or response was fetched during research.

- **Poverty (verified):** `https://www.indec.gob.ar/ftp/cuadros/sociedad/cuadros_informe_pobreza_MM_YY.xls`. The latest is `_09_26`, for the 1st half of 2026.
  - Cuadro 4.1 is poverty and Cuadro 4.2 is indigence. Each gives % of households and % of persons, with CVs, for 6 regions and 31 aglomerados.
  - It is a legacy `.xls` (BIFF) file, and the filename changes with every release.
- **Wages (verified):** `https://www.argentina.gob.ar/sites/default/files/provinciales_serie_remuneraciones_mensual_2dig_9.xlsx`, index page `https://www.argentina.gob.ar/node/142211`.
  - About 11 MB, one sheet per province plus GBA, CABA and "Resto Pcia. Bs. As.", January 1995 to June 2026.
  - The `_9` suffix changes between versions.
  - The datos.gob.ar series `71.*` and `72.*` stop in 2015, so they are not usable.
- **Inflation by region (verified):** the datos.gob.ar series API, for example `148.3_INIVELNIA_DICI_M_27` (Patagonia, general level).
  - The API lags INDEC by about 1–2 months.
  - Not verified: whether this December 2016 base stays aligned after INDEC's 2026 IPC method change.
- **Unemployment by aglomerado (not verified):** an INDEC XLS from the quarterly EPH labor market release. The series API aglomerado series stop in 2003.
- **Boundaries (verified):** `https://infra.datos.gob.ar/georef/provincias.geojson` (24 features, 614 KB) and `.../departamentos.geojson` (529 features, 1.2 MB). Both come from IGN, in WGS84, with INDEC codes. The georef JSON API returns centroids only.
- **Aglomerado locations:** INDEC publishes no official coordinates. The 31 points are hand-coded once in the repo, for example from georef `localidades`.

## Geography

- Province and department polygons are simplified once by a committed script and stored as static assets: TopoJSON or GeoJSON, a target of about 200 KB for both layers together.
- **Buenos Aires province is split in two (constraint).** Both the IPC regions and the wage file separate GBA from the rest of the province:
  - The GBA region is CABA plus the 24 GBA partidos.
  - The rest of Buenos Aires belongs to the Pampeana region.

  So region and wage layers are built from department polygons for Buenos Aires and from province polygons elsewhere. The list of 24 partidos is committed with its source.
- Department polygons are needed for this split from v1, and later for the census.
- **Antarctica and the South Atlantic islands (user approved the recommendation: "si avance con tu recomendacion").** IGN's Tierra del Fuego feature (id `94`) spans the Antarctic sector down to latitude -90 and the Malvinas and South Atlantic islands.
  - KPI colors fill only Isla Grande de Tierra del Fuego, the part the province's statistics describe.
  - The Malvinas, the other South Atlantic islands and the Antarctic sector are drawn as outlines without fill.
  - The basemap's own label for the islands is hidden, and the map draws its own label "Islas Malvinas".
  - No bicontinental inset.

## Interaction

- **Map gestures:** MapLibre with `cooperativeGestures` (my call).
  - On desktop, Ctrl/⌘ + wheel zooms the map; the wheel alone scrolls the page.
  - On phones, two fingers move the map; one finger scrolls the page.
  - The library shows its own hint.
  - Zoom buttons are shown.
- **First view:** fit to mainland Argentina plus Isla Grande de Tierra del Fuego and the Malvinas, not to the full IGN feature that reaches the South Pole (user approved).
- **Controls** sit above the map, in one row that wraps on phones: KPI, value variant when the KPI has more than one, and period.
- **Points** (aglomerados) are colored by value, all the same size (my call). Flagged high-CV points get a visible marker, explained in the legend and the tooltip.
- **Color:** one sequential single-hue scale per KPI, validated with the dataviz skill's palette checker against the light map surface. The legend shows the scale's breaks and units, and no-data areas are hatched or gray and labeled "Sin dato".
- **Tooltip:** place, value with unit, period, short source, and the warnings that apply (high CV, includes aguinaldo).

## Fit with the existing code

The new code follows the current layers, and the dependency rule is checked by grep:

- `app/` → `features/` → `components/` → `lib/indicators` (pure) → `lib/sources` (adapters).
- `lib/` imports no UI, and `components/` never imports `features/`.

Concretely:
- **Adapters** fetch and parse each source in `lib/sources`, return `Outcome<T>`, and cache with `cacheLife`.
- **Pure logic** goes in `lib/indicators/maps.ts`: a declarative KPI catalog (`MAP_KPIS`, in the style of `PANEL_CHARTS` and `MARK_LAYERS`), period lists, color breaks, and joining values to geography codes. It is tested with Vitest.
- **The map** is a client component in `features/maps/`, loaded only by `app/mapas/page.tsx`, so other tabs do not ship MapLibre.
- **Reuse:** `SourceReferences`, `SourceCitation` and `SiteNav` (the new tab is "Mapas"). New `SourceId`s are added for OEDE and the INDEC files.

## Constraints

- It is a public, free site on Vercel: no API keys and no paid tiles.
- Source files are fetched on the server and cached. A failed source shows a clear message for that KPI and does not break the tab, like the other tabs.
- The UI is in Spanish; code and docs are in English.
- `next/dynamic` behaves differently in this Next.js 16. Read the guide in `node_modules/next/dist/docs/` before using it or other newer APIs.

## Left to the builder

- **XLS parsing library.** The INDEC poverty file is legacy `.xls` and the OEDE file is `.xlsx`. A new dependency is risky, so pick one that reads both and is maintained, and say why.
- **Finding the latest file** when the filename suffix changes: scraping the index page, templating with a fallback, or a pinned URL with a check.
- How to parse the 11 MB wage workbook within Vercel's limits, for example by keeping only the needed columns and caching the result.
- Exact URL parameter names, color break method (quantiles or equal steps), and simplification tolerance.
- Whether unemployment also offers the activity and employment rates.
