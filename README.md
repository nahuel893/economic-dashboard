# Argentina economic dashboard

A fast, public dashboard of Argentina's economy: the dollar in all its flavours, inflation, reserves, rates and markets, from official and market sources. No database, no keys, no sign-up.

The UI is in Spanish (`es-AR`).

![Next.js 16](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/tested_with-Vitest-6e9f18?logo=vitest&logoColor=white)

![The "Hoy" tab: dollar quotes, exchange-rate pressure and comparison charts](docs/home.png)

## Quick start

Requires Node 24.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Command | What it does |
|---------|--------------|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm test` | Unit tests (parsers, statistics, history windows) |
| `npm run lint` | ESLint |

No environment variables are needed: every source is a free, public API.

## What's inside

### Hoy: today's numbers

| Section | Indicators |
|---------|------------|
| Dólar | Oficial, blue, MEP, CCL |
| Presión cambiaria | CCL vs. oficial gap, wholesale rate (A3500) inside the exchange-rate band, crypto dollar (USDT) |
| Inflación | Monthly, year-on-year, expected in 12 months (REM median) |
| Actividad económica | GDP month by month (INDEC's EMAE): year-on-year and seasonally adjusted monthly change |
| Dinero y crédito | Reserves, monetary base, private M2, deposits, private-sector loans |
| Tasas | 30-day term deposit, TAMAR, BADLAR, personal loans, overdrafts, real rate |
| Mercados | Country risk, Merval in pesos and in CCL dollars |
| Índices | UVA, CER, ICL |

The hot indicators refresh every 2 minutes in the browser. Each section ends with a comparison panel: a chart with selectable series (level, base 100 or change, depending on what the section measures) and a correlation matrix with 95 % confidence intervals.

### Panel: the whole economy on one screen

A dense, full-width dashboard in the style of a BI report: ten key indicators with their latest value, change over the period and a sparkline, a large chart of the selected indicator, and eight topic charts (dollars, gap, rates vs. inflation, activity, monthly inflation, country risk, reserves).

- One period filter drives every number and chart, and lives in the URL like on Histórico.
- Clicking an indicator shows it in the large chart.
- Every chart plots the close of each month, so daily and monthly series share one axis: hovering a month on any chart shows that month on all of them.

### Histórico: the series over time

![The "Histórico" tab: one line chart per variable with a month and year range filter](docs/history.png)

One line chart per variable (dollars, gap, inflation, economic activity, country risk, reserves, BADLAR) since 2003, with presets (1, 3, 5, 10 years, all) or any month-to-month range. The range lives in the URL, so every view can be shared.

- Long ranges show weekly or monthly closes; min, max and change are computed on every point.
- Price-level series can switch to a log axis per chart; it is off by default.
- **Exportar video** downloads a 10-second 1920×1080 animation of the chart as shown, with its window, scale and marks: the line draws itself with a bubble on its latest value, and value labels stay on the start of each period. It is recorded in the browser (MP4 where supported, WebM otherwise), so keep the tab visible while it records.
- Optional marks add context to every chart and can be combined. The first layer, **Presidencias**, shades each presidential term from its inauguration day and names the president in the tooltip. Active layers are kept in the URL (`?marcas=presidencias`).

## Data sources

| Source | Used for |
|--------|----------|
| [dolarapi.com](https://dolarapi.com) | Live dollar quotes |
| [ArgentinaDatos](https://argentinadatos.com) | Dollar history, inflation, country risk |
| [INDEC via datos.gob.ar](https://datos.gob.ar/series) | Economic activity (EMAE) |
| [BCRA, Estadísticas v4](https://www.bcra.gob.ar/en/central-bank-api-catalog/) | Reserves, money, rates, REM, indexes, exchange-rate band |
| [BYMA open data](https://open.bymadata.com.ar) | Merval |

Every card and chart cites its source by name, linked to the full references at the bottom of the page: endpoints, BCRA variable numbers, INDEC series ids and how often each one is queried (`src/lib/indicators/references.ts`).

If a source fails, only its tiles show "No disponible"; the rest of the page still renders, and the build never fails because of it. Cached requests return failures as values (`attempt`/`unwrap` in `src/lib/sources/clients.ts`), because a cached function that throws aborts the prerender, and a failure is retried after a minute. Market data may be delayed. Nothing here is financial advice.

## How it works

```text
src/
├── app/               routes: / (Hoy), /panel, /historico, /api/hot
├── features/          UI by feature: hot, macro, compare, panel, history
├── components/        shared UI (shadcn/ui, nav, tiles)
└── lib/
    ├── sources/       HTTP clients and response parsers
    └── indicators/    snapshots, statistics, history windows (pure, tested)
```

- **Caching without a database.** Next.js Cache Components (`"use cache"` + `cacheLife`) keep each snapshot for minutes (live data) or a day (history), so the upstream APIs are hit rarely and pages load in milliseconds.
- **Server first.** Pages render on the server; only the charts, the range filter and the live polling (SWR on `/api/hot`) run in the browser.
- **Pure logic, tested.** Parsing, statistics and history windows are plain functions covered by Vitest.

## Deploy

The repo is ready for [Vercel](https://vercel.com/new): import it and deploy with the defaults. `vercel.json` pins the São Paulo region (`gru1`), close to the Argentine APIs, and `package.json` pins Node 24.
