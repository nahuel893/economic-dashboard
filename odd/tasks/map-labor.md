# Mapas: labor KPIs

Objective: add two labor KPIs to the Mapas tab: registered private employment by province and the EPH activity and employment rates by aglomerado.
Branch: `feat/map-labor` (integration). Units: `feat/map-employment` and `feat/map-eph-rates`, each in its own worktree under `../economic-dashboard-worktrees/`.
Delivery: exception-ok. Each worktree branch is one slice, merged into `feat/map-labor`; pushing to main needs the user's approval. Test runner: Vitest (`pnpm test`), plus `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm build`.

## Specs

- **S1 Two parallel units.** My question: "¿Arrancamos por las dos de esfuerzo bajo (empleo registrado y tasas de la EPH) o vamos directo al censo por departamento?" User: "si dividi en 2 subagentes sonnet 5.5 esa tarea. Que lo trabajen en 2 wt."
  - One Sonnet 5.5 writer per unit, each in its own git worktree.
- **S2 Registered private employment by province.** This is the first low-effort row I proposed: "Empleo registrado privado | Provincia | Mensual | OEDE (SIPA), el mismo tipo de planilla que sueldos | Bajo: reusa el lector de sueldos".
  - My call: new KPI `?kpi=empleo`, label "Empleo registrado", drawn on areas like wages.
  - My call: variants `variacion` (year-on-year % change, the default, because raw counts always rank Buenos Aires first) and `puestos` (number of jobs).
- **S3 EPH activity and employment rates by aglomerado.** This is the second low-effort row: "Tasa de actividad y de empleo | 31 ciudades (aglomerados) | Trimestral | INDEC, EPH | Bajo: es probable que estén en el mismo archivo que desocupación, pero falta confirmarlo".
  - My call: new KPI `?kpi=actividad`, label "Actividad y empleo", drawn on aglomerado points like unemployment.
  - My call: variants `actividad` (activity rate, the default) and `empleo` (employment rate).
  - If the published files do not have these rates by aglomerado, the unit stops and reports, without inventing data.
- **Unchanged.** The existing KPIs, URLs and outputs stay as they are.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1, S2 | delegated (parallel with T2, worktree `map-employment`) | done | 87d09c1 |
| T2 | S1, S3 | delegated (parallel with T1, worktree `map-eph-rates`) | done | 2c6366e |
| T3 | S1-S3 | inline | done | d739d0a, ec10514, 2bdfaed |

- **T1:** OEDE registered employment by area: source, parser and tests, KPI entry, references and README.
- **T2:** EPH activity and employment rates: extend the snapshot script, commit the snapshot, then the source, tests, KPI entry, references and README.
- **T3:** merge both branches into `feat/map-labor`, resolve the shared-file conflicts (`maps.ts`, `page.tsx`, `references.ts`, README), run the full checks once, and do a CDP check of both KPIs.

Route evidence: the user asked for two parallel writers in two worktrees. The units are independent, but both touch the KPI catalog, the page loader and the README, so isolated worktrees are required.

## Log

- **L1 (2026-11-05), user:** "si dividi en 2 subagentes sonnet 5.5 esa tarea. Que lo trabajen en 2 wt. https://datos.produccion.gob.ar/dataset/sepa-precios luego necesito que planifiquemos otra oja con datos de precios de articulos."
  - The SEPA prices sheet is a separate feature, planned later. It is not part of this document.
- **L2:** Sources come from the Engram research `maps/data-sources`. OEDE publishes registered employment by province in an XLSX like the wages one. The EPH labor report `cuadros_eph_informe_09_26.xls` already feeds unemployment from Cuadro 1.8.
- **L3 (T1, S1-S2):** OEDE publishes provincial employment per quarter (`provinciales_serie_empleo_trimestral_2dig_7.xlsx`, one sheet per province, TOTAL row), not per month, so the KPI is quarterly (12 quarters, year-on-year needs 4 more). Verified: `pnpm test` 179 passed, `pnpm lint` clean, `tsc --noEmit` clean, `/mapas?kpi=empleo` and `&valor=puestos` render with real data on `next dev`; `pnpm build` fails on `/` (Invalid time value in hot tiles) also at the base commit. Commit 87d09c1.
- T2 (map-eph-rates): INDEC workbook cuadros_eph_informe_09_26.xls has activity (Cuadro 1.6) and employment (1.7) by aglomerado in the same layout as 1.8; no CV is published for them. New snapshot eph-rates.json; poverty and unemployment snapshots regenerate byte-identical. Tests 168 passed, lint clean, tsc clean after typegen; `/mapas?kpi=actividad[&valor=empleo]` returned 200 with the expected labels on `next dev` (`pnpm build` fails on `/` before and after this change, Invalid time value in hot tiles).
- **L5: T3 merge and checks.** Both builders reported `pnpm build` failing on `/` at the base. Cause: BYMA's index-price response no longer has a `date` field, so `formatDate(undefined)` threw while prerendering the Merval tile. Fixed on `fix/merval-date` (14d8c0f, test first: RED, then GREEN), and that branch was merged first.
  - Conflicts in the KPI catalog, page loader, tests, references and README were resolved as the union of both units. KPI order: salarios, empleo, pobreza, inflacion, desocupacion, actividad.
  - Checks on the merge: 181 tests, tsc, lint and `pnpm build` pass. `/`, `/mapas?kpi=empleo`, `&valor=puestos`, `?kpi=actividad`, `&valor=empleo` and `?kpi=desocupacion` return 200.
  - CDP check on the production build: "Mendoza Variación interanual: -3,5 % 1.er trimestre de 2026 · OEDE (SIPA)", "La Pampa Puestos de trabajo: 40.566", "Gran Córdoba Tasa de actividad: 50,9 % 2.º trimestre de 2026 · INDEC, EPH". No console errors.
  - **Advisory:** the year-on-year employment change spans negative and positive values but uses the one-hue scale; a diverging scale would show the sign. Not changed, it was not asked for.
  - Not pushed: it needs the user's approval.

