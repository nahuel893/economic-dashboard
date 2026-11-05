# Chart zoom

Objective: zoom into a period on the series charts, with the Y scale refitting to what is visible. Branch: `feat/chart-zoom`. Delivery: ask-on-risk. Test runner: Vitest (`npx vitest run`), plus tsc, lint, build and a browser check over CDP.

## Specs

- **S1 Where.** User: "que se pueda hacer zoom en el grafico grande, en el dashboard y en el historico. y bueno creo que en todas las tarjetas de series y graficos".
  - Scope from the approved proposal (user: "perfecto vamos con esa implementacion"):
    - every chart on Histórico, each one on its own;
    - every chart on Panel;
    - on Hoy, only the comparison charts.
  - Out of scope: the sparklines in the Hoy tiles (30 points), the inflation column charts (13 months) and the KPI sparklines on Panel.
- **S2 Dynamic scale.** User: "Que se puede hacer zoom y que la escala se ajuste dinamicamente". While zoomed, the Y axis fits the minimum and maximum of the visible data, and the X ticks fit the visible span.
- **S3 Mouse interaction (approved proposal).**
  - Dragging horizontally over a chart selects a period and zooms into it; the selection is shown while dragging. A click without a span does not zoom.
  - A "Restablecer zoom" button appears while zoomed; double click also resets.
  - The mouse wheel is not used, so page scroll is untouched.
- **S4 Touch (approved proposal).**
  - The large charts get a range slider below them (two native range inputs, start and end) that also works with the finger: the Panel featured chart and every Histórico chart.
- **S5 Panel zoom is shared (approved proposal).**
  - Zooming any Panel chart zooms all Panel charts to the same months.
  - The KPI cards do not change: they follow the period filter.
- **S6 Mobile gestures.** User: "en mobile tambien choca con el zoom de pagina, que podemos hacer?"
  - Touch never starts a chart zoom: drag-to-zoom and double-click reset react to the mouse only.
  - Scroll, pinch-zoom and double-tap-zoom of the page keep working.
  - No `touch-action: none`, and no viewport scale limits.
- **Assumptions (mine, to confirm at the end):**
  - Zoom is visual. The period stats (variation, min, max) and the period filter keep describing the selected period.
  - Changing the period filter clears the zoom.
  - No finer data is fetched: zooming into a long range shows its weekly or monthly closes.
  - The Histórico video export records the chart as shown, including the zoom.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S2, S3, S6 | inline | pending | |
| T2 | S1, S2, S3, S4, S6 | inline | pending | |
| T3 | S1, S2, S4, S5, S6 | inline | pending | |
| T4 | S1, S2, S3, S6 | inline | pending | |
| T5 | S1-S6 | inline | pending | |

- **T1:** shared zoom pieces with tests: pure window helpers in lib, a mouse-only drag hook, the reset control and the range slider.
- **T2:** Histórico charts. Marks and X-axis labels are recomputed on the visible dates, and the slider is added.
- **T3:** Panel shared zoom, with the slider on the featured chart.
- **T4:** Hoy comparison charts.
- **T5:** README and the page hints, then a browser check of S1-S6.

Route evidence: no Writer trigger holds. The units depend on T1 and are written in sequence, so all of them stay inline.

## Log

- **L1 (2026-11-04), user:** "y ahora necesito lo siguiente, que se pueda hacer zoom en el grafico grande, en el dashboard y en el historico. y bueno creo que en todas las tarjetas de series y graficos. Que se puede hacer zoom y que la escala se ajuste dinamicamente"
- **L2:** Proposal sent, covering the drag, the reset button and double click, the touch slider, Panel-wide zoom, and Hoy comparison charts only. User: "perfecto vamos con esa implementacion".
- **L3 (2026-11-04), user:** "en mobile tambien choca con el zoom de pagina, que podemos hacer?" Answer: touch never triggers chart zoom (mouse only); the slider is the touch path; page gestures stay intact. Added as S6.
- **L4:** Exploration findings:
  - Recharts 3 chart mouse handlers receive `activeLabel`.
  - Marks are snapped to axis dates by `spansOnAxis` in `src/lib/indicators/marks.ts`, so they must be recomputed on the visible dates.
  - The layout sets no viewport scale limits.
