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
| T1 | S2, S3, S6 | inline | done | 1383999 |
| T2 | S1, S2, S3, S4, S6 | inline | done | 26717cd |
| T3 | S1, S2, S4, S5, S6 | inline | done | d8dac51 |
| T4 | S1, S2, S3, S6 | inline | done | 238ebf4 |
| T5 | S1-S6 | inline | done | see L9 |

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
- **L5:** T1 done (1383999).
  - Pure window helpers have 9 tests.
  - Drag starts only with the mouse (pointerType); touch uses the slider.
- **L6:** T2 done (26717cd). CDP check on /historico?desde=2016-01&hasta=2026-11:
  - **Mouse drag:** zoom to "diciembre de 2021 – febrero de 2025"; X ticks 2022-2025; Y refits from "$ 0 … $ 1.600" to "$ 200 … $ 1.200" (zoomed linear charts now use a tight domain, because the library anchored them at zero).
  - **Double click:** resets.
  - **Slider with keyboard:** zooms.
  - **Touch drag and double tap** (mobile emulation with touch): no zoom, and the page scrolls.
  - **Marks:** placed again with `placeAgain` (tested).
  - **Test artifact:** a horizontal touch swipe without touch emulation triggered Chrome history-back; the history is now reset before checks.
  - **Advisory, pre-existing in prod:** the Recharts focus box shows on mouse press.
- **L7:** T3 done (d8dac51). CDP check on /panel: a drag on the featured chart zooms all 9 charts ("Zoom: marzo de 2024 – abril de 2025"); "Restablecer zoom" resets; touch does not zoom. The KPI cards keep the period values.
- **L8:** T4 done. CDP check on / (first comparison chart, "Comparar cotizaciones"):
  - **Mouse drag:** "Zoom: 24/09 – 21/10"; X ticks 27/09-21/10; Y refits from "$ 1.500 … $ 1.700" to "$ 1.540 … $ 1.620".
  - **Double click:** resets.
  - **Touch drag and double tap:** no zoom, and the page scrolls.
  - The header period and the correlation matrix keep describing all loaded points (n = 63), like assumption 1.
- **L9:** T5 done: README (Hoy, Panel, Histórico) and the Panel and Histórico intros describe the zoom. Final CDP check on the production build, all tabs:
  - **S1-S3:** mouse drag zooms Histórico ("diciembre de 2021 – febrero de 2025", Y "$ 200 … $ 1.200"), Panel (all 9 charts, "marzo de 2024 – abril de 2025") and Hoy ("24/09 – 21/10", Y "$ 1.540 … $ 1.620"); double click or "Restablecer zoom" resets. No wheel handler in src.
  - **S4:** the keyboard on the Histórico slider gives "mayo de 2019 – noviembre de 2026"; the Panel featured chart has the slider ("diciembre de 2021 – noviembre de 2025").
  - **S5:** one Panel drag zooms every chart; the KPI cards are unchanged.
  - **S6:** touch drag and double tap on Histórico and Hoy do not zoom and the page scrolls; no `touch-action` or viewport scale limits in src.
  - Tests 112 passed, tsc and lint clean, build ok.
- **Open:** the period stats (variation, min, max) still describe the selected period while zoomed. Ask the user at closure (assumption 1).
