"use client";

import { useSyncExternalStore } from "react";

/**
 * Chart tooltips on touch screens. Recharts opens a tooltip on a tap and closes
 * it when the mouse leaves the chart, but a finger never "leaves": scrolling
 * the page, or tapping a part of it that is not clickable on iOS, sends no
 * mouse events, so the tooltip stayed open. A touch outside every chart now
 * hides all chart tooltips, and a touch on a chart or any mouse movement lets
 * Recharts show them again.
 */
export function hidesTooltips(pointerType: string, onChart: boolean): boolean {
  return pointerType !== "mouse" && !onChart;
}

const CHART = ".recharts-wrapper";

let hidden = false;
const listeners = new Set<() => void>();

function update(event: PointerEvent) {
  const onChart = event.target instanceof Element && event.target.closest(CHART) !== null;
  const next = hidesTooltips(event.pointerType, onChart);
  if (next === hidden) return;
  hidden = next;
  for (const listener of listeners) listener();
}

const options = { capture: true, passive: true } as const;

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    document.addEventListener("pointerdown", update, options);
    document.addEventListener("pointermove", update, options);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      document.removeEventListener("pointerdown", update, options);
      document.removeEventListener("pointermove", update, options);
    }
  };
}

/**
 * The `active` prop for a Recharts Tooltip: false while a touch outside the
 * charts has hidden the tooltips, undefined to let Recharts decide.
 */
export function useTooltipActive(): false | undefined {
  const isHidden = useSyncExternalStore(
    subscribe,
    () => hidden,
    () => false,
  );
  return isHidden ? false : undefined;
}
