# Mapas tab

Objective: a Mapas tab with one navigable map and selectable KPIs (wages, poverty, inflation, unemployment). Branch: `feat/maps`, on top of `chore/pnpm`. Delivery: ask-on-risk. Test runner: Vitest (`pnpm test`), plus tsc, lint, build and a browser check over CDP. Design: `docs/superpowers/specs/2026-11-05-maps-design.md`. It is the detailed specification; the specs below quote the user.

## Specs

- **S1 One map, selectable KPIs.** User: "Podemos organizarlo por kpis, un solo mapa con kpis seleccionables. *niveles de pobreza en distintos valores, porcentajes, por privincia etc *promedio de sueldos por provincia"
- **S2 Honest geography.** User: "Perfecto, hay que aplicar ese criterio. Mientras se vea sobre el mapa, esta correcto."
  - Poverty is drawn per EPH aglomerado, never painted on provinces.
- **S3 Navigable basemap.** User: "Si creo que es mejor tener el fondo navegable. Igual en general se va a ver a nivel provincia / dpto"
  - OpenFreeMap, user: "vamos con el primero, por el momento."
- **S4 Light basemap, latest data, selectable period.** User: "me gustaria que sea fondo blanco. Si el ultimo dato, y selecionable"
- **S5 Antarctica and Malvinas.** User: "si avance con tu recomendacion"
  - Fill only Isla Grande de Tierra del Fuego.
  - Draw the Malvinas, the South Atlantic islands and the Antarctic sector as outlines.
  - Show the map's own "Islas Malvinas" label, and frame the first view on the mainland.
- **S6 No fake heat map.** User: "Luego mapa de calor, que kpis pueden mostrar mapa de calor"
  - Answered by the research: there is no point-level data. "Heat" is a sequential color scale on areas, and a density heat map is out of scope.
- **S7 Later:** other existing KPIs on the map. User: "Luego podriamos ver que otros kpis que ya tenemos se pueden dividir o mostrar en el mapa". The v1 adds inflation by region and unemployment by aglomerado (my calls in the design); the rest stays out of v1.
- **Design approved.** User: "dale metele", then "implementalo ya".

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T0 | (pnpm request) | inline | done | bbaf5bb (pushed to main) |
| T1 | S1, S3 | inline | done | f7cb616 |
| T2 | S1, S2, S4 | delegated (parallel with T3) | done | see L9 |
| T3 | S2, S3, S5 | delegated (parallel with T2) | done | eb55b87 |
| T4 | S1-S6 | delegated (context backstop) | pending | |
| T5 | S1-S7 | inline | pending | |

- **T0:** switch from npm to pnpm. The user asked "podes migrar a npx?", then "perdon, mejor diche pnpm".
- **T1:** dependencies: maplibre-gl, react-map-gl, read-excel-file.
- **T2:** data sources, each returning `MapSeries` from `src/lib/indicators/map-data.ts`:
  - OEDE wages by area, from the runtime xlsx;
  - IPC by region, from the series API;
  - EPH poverty and unemployment by aglomerado, as committed snapshots built by a script.
- **T3:** geography assets: simplified areas (Buenos Aires split, Tierra del Fuego clipped) and outlines (Malvinas, South Atlantic, Antarctic sector), plus a check of the aglomerado coordinates.
- **T4:** the map page:
  - the catalog and color logic in `lib/indicators/maps.ts`;
  - the client map in `features/maps`;
  - the route `/mapas`;
  - the nav tab and source references.
- **T5:** README, then a CDP check of S1-S6 on desktop and mobile.

Route evidence:
- T2 and T3 are independent units with disjoint edit surfaces, each several files of work, so they run as parallel writers.
- T4 is delegated as the long-session backstop: this session's context is well past the advisory budget.

## Log

- **L1 (2026-11-05), user:** "vamos con datos demograficos en mapas."
- **L2:** Research findings (Engram topic `maps/data-sources`):
  - INDEC publishes poverty only for 31 aglomerados and 6 regions.
  - OEDE publishes monthly provincial private wages.
  - IGN boundaries are available as GeoJSON from georef.
  - No source has point-level data.
- **L3:** The design was written and builder-checked. User decisions: MapLibre with OpenFreeMap, light basemap, latest data with a period selector, and the Malvinas and Antarctica outline rule. User: "implementalo ya".
- **L4: Deviation from the design.** npm and pnpm here refuse remote tarballs, and the `xlsx` package on npm is stuck at 0.18.5 with advisories, so there is no maintained `.xls` (BIFF) reader.
  - EPH poverty and unemployment therefore become committed JSON snapshots, built by a script that converts the `.xls` with LibreOffice. Poverty is published every six months and unemployment every three.
  - OEDE wages (`.xlsx`) are still read at runtime with read-excel-file.
- **L5:** T0. pnpm 12.16.1 is installed in `~/.local` (no sudo). The lockfile was imported from npm, so versions are unchanged.
  - Checks: tsc, lint, 115 tests and the build pass with pnpm 12.
  - A scratch copy installs `--frozen-lockfile`, builds and tests with real pnpm 10.34.9, the version Vercel picks for lockfile 9.0.
  - Not pushed: it needs the user's approval.
- **L6 (2026-11-05), user:** "perfecto si anda pusheando eso." The pnpm switch (bbaf5bb) is pushed to main, the Vercel build succeeds, and /, /panel and /historico return 200 in production.
- **L7 (2026-11-05), user:** "cuando termine lo otro pushealo tambien". The finished Mapas feature may be pushed to main once its checks pass.
- **L8:** T3 done (eb55b87). `scripts/geo/build-geo.mjs` uses georef plus mapshaper 0.7.101 through pnpm dlx and gives the same output on every run.
  - **areas.json:** 140 KB, the 25 AREAS ids. Buenos Aires resto is the province minus the 24 GBA partidos, because a dissolve of its departments left holes. Tierra del Fuego is filled on Isla Grande only.
  - **outlines.json:** 52 KB, with Malvinas, Atlántico Sur, Antártida Argentina, Isla de los Estados and an "Islas Malvinas" label point.
  - **MAP_BOUNDS:** [[-73.6,-55.1],[-53.6,-21.7]].
  - **Aglomerado coordinates:** all within 3.2 km of georef, so none were changed.
  - **Checks:** geography test 5/5, and the parent re-ran it with the same result. The country render was inspected.
  - **Open for T4:** at country zoom the CABA and GBA points overlap; they separate from about zoom 7.
- **L9:** T2 done. Checks: 141 tests, tsc and lint pass; the parent re-ran them with the same result.
  - **Wages:** OEDE wages are read at runtime with `CACHE.slow` and keep 36 months; the latest is 2026-06, marked "Incluye aguinaldo".
    - OEDE's "GRAN BUENOS AIRES" row excludes CABA and maps to 06-gba; "BUENOS AIRES" equals the rest of the province and maps to 06-resto.
    - The workbook URL is discovered from the index page, with the pinned `_9` URL as fallback.
  - **IPC regions:** they use the `145.3_*` series family, because the 148.3 NOA series is empty; the latest is 2026-08.
  - **EPH:** the snapshots are built by `scripts/maps/eph-snapshots.mts`.
    - Poverty covers 2026-H1 only (four variants with CV). Older releases flag CV > 16 % instead of the exact CV, so they are left for later.
    - Unemployment comes from Cuadro 1.8, for 12 quarters from 2023-Q3 to 2026-Q2. INDEC's "///" cells are omitted.
  - **Citations:** moved to T4, because `references.ts` must change with them.
