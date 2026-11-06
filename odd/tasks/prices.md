# Prices tab: SEPA product price finder on a map

Objective: a new "Precios" tab that searches any product published in SEPA and shows its price at every supermarket on a map of the country.
Branch: feat/prices (fast-forwarded to main on approval, as in earlier features). Delivery: work-unit commits on the branch.
Runner: Vitest + tsc + lint + `pnpm build` + CDP checks against a local data server.

## Specs

- S1 Search and map. The user asked: "basicamente quiero un buscador de precios, que se pueda seleccionar una articulo y ver su precio en un mapa del pais".
- S2 Library and performance. The user said: "creo que en este caso quizas seria mejor leaflet, o no, decidilo vos. Prioriza rendimiento."
  - My call: MapLibre (WebGL, already used by Mapas) instead of Leaflet.
  - Per-product payloads stay small (about 1 KB on average, 16 KB at worst) and are read with byte ranges.
- S3 Data. The user wrote: "Vas a tener que laburar con los data sets de SEPA que son grandes y densos." The source is https://datos.produccion.gob.ar/dataset/sepa-precios.
  - The file is about 325 MB zipped and 1.6 GB unzipped per day, with 14.3M prices, 81k EANs and 2.7k branches.
  - It is preprocessed once a day outside the page.
  - Bad chain zips, broken branch rows and non-EAN codes are skipped and reported, not fatal.
- S4 Points. The user asked for "cada supermercado como punto". Each branch is one point colored by its price, with a price label and a tooltip.
- S5 Freshness (assumption: the history question went unanswered with "perfecto metele"). Only the latest SEPA day is shown, with its date. Price history is a non-goal for now.

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S3 | inline: binary format + `scripts/prices/build-sepa.mts` with fixture tests | done | a526311, 1e07e9c |
| T2 | S3 | inline: GitHub Actions daily job publishing release `sepa-data` (Risk item 5) | done, ran on GitHub | adb89d2, 92c8d9d |
| T3 | S1 S2 S5 | inline: server adapter (catalog, search, range read) + `/api/precios` | done | 8717d13, e308937 |
| T4 | S1 S2 S4 S5 | inline: `/precios` page, search box, price map, summary, table, nav, references | done | cc4d954, 1966d10 |
| T5 | S1-S5 | inline: end-to-end against a local data server, CDP checks, README | done | this commit |

Route evidence: there is one coherent feature whose units share the format contract, so no writer trigger fires and the work stays inline.

## Log

- L1 (2026-11-05) The user's request: "https://datos.produccion.gob.ar/dataset/sepa-precios luego necesito que planifiquemos otra oja con datos de precios de articulos."
- L2 (2026-11-05) The user wrote: "vamos con los precios, basicamente quiero un buscador de precios, que se pueda seleccionar una articulo y ver su precio en un mapa del pais, creo que en este caso quizas seria mejor leaflet, o no, decidilo vos. Prioriza rendimiento. Vas a tener que laburar con los data sets de SEPA que son grandes y densos."
- L3 (2026-11-05) The user answered "cada supermercado como punto", then "perfecto metele" to the plan: preprocess daily into small files, server-side search, latest day only.
- L4 Recon on the jueves 2026-11-05 zip.
  - `productos.csv` has 17 pipe fields, a BOM, and footer lines starting "Ultima actualizacion". `productos_ean` is 0 for 173k internal codes.
  - `sucursales.csv` has 21 fields. Records are split over lines with no quoting, so lines are joined until the field count reaches 21. Provinces are ISO 3166-2 (AR-X).
  - The inner zip for comercio-sepa-36 was corrupt.
  - GitHub release downloads honor `Range` (206), so the server reads one product's bytes from a single file.
- L5 (2026-11-05) Build on the real day: 63 s, 26 chains, 2,685 branches, 77,525 products, 14.09M prices; index 2.3 MB gz, branches 276 KB, prices 85 MB. One corrupt chain zip was skipped.
  - Naming fix: a product's name is now the one most chains use, with the fullest name winning a tie. DIA's terse names had been winning by branch count.
  - Banners that share a name are merged into one chain. A zero street number is dropped.
- L6 Workflow pruning dry-run: only days older than the newest two are deleted, and `sepa-latest.json` is never deleted. An earlier `grep -f` version was replaced.
- L7 Checks: 23 files and 256+ tests pass, along with tsc, lint and build. `/api/precios` cold took 0.32 s and warm 7 ms against a local range server.
  - CDP desktop: typing gives 12 options in about 210 ms; picking with the keyboard renders the product in about 150 ms; tooltip OK; no console errors.
  - CDP phone 390 px: 5 tabs fit, the map comes before the tiles, list names wrap to 2 lines, tooltip pinned. Mapas is unchanged after the setup refactor.
  - Ranking: names starting with the first query word come first ("leche serenisima" gives milk before dulce de leche).
  - Note: RED was not observed for `src/lib/indicators/prices.ts` (code and tests were written together); all other units were test-first.
- L8 Pending: the RDD review is due (`high_risk`, shell in the workflow) and needs the user's consent. The workflow first runs after push (run it by hand), so production shows "No disponible" until then. Pushing needs the user's approval.
- L9 (2026-11-05) The user wrote "si revisalo y pushea".
  - RDD review review-af78dc861908c0ab (risk, resilience, reliability) was approved and acknowledged, with 9 non-blocking findings for later:
    - same-date rebuild clobbers files that are under an in-memory index;
    - a product read failure blanks the whole page;
    - a version mismatch drops the stale fallback;
    - a "0000" query matches everything;
    - a stale Enter pick;
    - the workflow pins actions by tag instead of SHA.
  - Pushed main a8ccbf5.
- L10 The first workflow run failed: setup-node@v5 read packageManager pnpm and looked for pnpm to cache.
  - Fixed with `package-manager-cache: false` (92c8d9d). Review review-29078d96c4586c44 was approved after the user wrote "pero ya te dije que si"; pushed.
  - Run 42150113121 succeeded in 1m32s with the same counts as local (one corrupt chain skipped).
  - Prod: search cold 2.2 s and warm 0.37 s; a product page on a cold instance about 2.4-4 s. CDP desktop on prod was OK with no console errors.
