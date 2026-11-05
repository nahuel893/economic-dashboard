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
| T1 | S1, S2 | delegated (parallel with T2, worktree `map-employment`) | done | see Log |
| T2 | S1, S3 | delegated (parallel with T1, worktree `map-eph-rates`) | pending | |
| T3 | S1-S3 | inline | pending | |

- **T1:** OEDE registered employment by area: source, parser and tests, KPI entry, references and README.
- **T2:** EPH activity and employment rates: extend the snapshot script, commit the snapshot, then the source, tests, KPI entry, references and README.
- **T3:** merge both branches into `feat/map-labor`, resolve the shared-file conflicts (`maps.ts`, `page.tsx`, `references.ts`, README), run the full checks once, and do a CDP check of both KPIs.

Route evidence: the user asked for two parallel writers in two worktrees. The units are independent, but both touch the KPI catalog, the page loader and the README, so isolated worktrees are required.

## Log

- **L1 (2026-11-05), user:** "si dividi en 2 subagentes sonnet 5.5 esa tarea. Que lo trabajen en 2 wt. https://datos.produccion.gob.ar/dataset/sepa-precios luego necesito que planifiquemos otra oja con datos de precios de articulos."
  - The SEPA prices sheet is a separate feature, planned later. It is not part of this document.
- **L2:** Sources come from the Engram research `maps/data-sources`. OEDE publishes registered employment by province in an XLSX like the wages one. The EPH labor report `cuadros_eph_informe_09_26.xls` already feeds unemployment from Cuadro 1.8.
