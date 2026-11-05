"use client";

import { useRef, useState, type PointerEvent } from "react";
import { selectionToWindow, windowFromIndices, windowIndices, type ZoomWindow } from "@/lib/indicators/zoom";
import { cn } from "@/lib/utils";

type ChartMouseState = { activeLabel?: string | number } | null | undefined;

/**
 * Drag-to-zoom for a Recharts chart. Only a mouse starts it: on touch screens
 * dragging scrolls and pinching zooms the page as usual, and the slider is the
 * way to zoom. Double click resets, also with the mouse only, so a double tap
 * still zooms the page.
 */
export function useZoomDrag(keys: string[], onZoom: (window: ZoomWindow | null) => void) {
  const pointer = useRef("mouse");
  const [drag, setDrag] = useState<{ start: string; end: string } | null>(null);
  const label = (state: ChartMouseState) => (state?.activeLabel === undefined ? undefined : String(state.activeLabel));

  return {
    /** The span being selected, to draw while dragging. */
    selection: drag,
    /** For the element around the chart. */
    containerProps: {
      onPointerDownCapture: (event: PointerEvent) => {
        pointer.current = event.pointerType;
      },
      onDoubleClick: () => {
        if (pointer.current === "mouse") onZoom(null);
      },
      className: cn("select-none", drag && "cursor-ew-resize"),
    },
    /** For the Recharts chart. */
    chartProps: {
      onMouseDown: (state: ChartMouseState) => {
        const at = label(state);
        if (pointer.current === "mouse" && at !== undefined) setDrag({ start: at, end: at });
      },
      onMouseMove: (state: ChartMouseState) => {
        const at = label(state);
        if (drag && at !== undefined && at !== drag.end) setDrag({ ...drag, end: at });
      },
      onMouseUp: () => {
        if (!drag) return;
        setDrag(null);
        const window = selectionToWindow(drag.start, drag.end, keys);
        if (window) onZoom(window);
      },
      onMouseLeave: () => setDrag(null),
    },
  };
}

type ZoomBarProps = { window: ZoomWindow | null; onReset: () => void; format: (key: string) => string; className?: string };

/** What is zoomed and how to go back; nothing when the chart is not zoomed. */
export function ZoomBar({ window, onReset, format, className }: ZoomBarProps) {
  if (!window) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 text-xs", className)}>
      <span className="text-muted-foreground">
        Zoom: {format(window.from)} – {format(window.to)}
      </span>
      <button
        type="button"
        onClick={onReset}
        className="rounded-full px-2.5 py-1 font-medium ring-1 ring-foreground/20 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        Restablecer zoom
      </button>
    </div>
  );
}

const thumb =
  "pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-grab " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground " +
  "[&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-card " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-grab " +
  "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground " +
  "focus-visible:outline-none [&:focus-visible::-webkit-slider-thumb]:outline-2 [&:focus-visible::-webkit-slider-thumb]:outline-ring";

type ZoomSliderProps = { keys: string[]; window: ZoomWindow | null; onChange: (window: ZoomWindow | null) => void; format: (key: string) => string };

/** Start and end of the zoom as two native range inputs: works with touch, mouse and keyboard. */
export function ZoomSlider({ keys, window, onChange, format }: ZoomSliderProps) {
  if (keys.length < 3) return null;
  const last = keys.length - 1;
  const [start, end] = windowIndices(keys, window);
  const percent = (index: number) => `${(index / last) * 100}%`;

  return (
    <div className="relative h-6" role="group" aria-label="Período del zoom">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" aria-hidden />
      <div
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-tone"
        style={{ left: percent(start), right: `calc(100% - ${percent(end)})` }}
        aria-hidden
      />
      <input
        type="range"
        min={0}
        max={last}
        value={start}
        aria-label="Inicio del zoom"
        aria-valuetext={format(keys[start])}
        onChange={(e) => onChange(windowFromIndices(keys, Math.min(Number(e.target.value), end - 1), end))}
        className={thumb}
      />
      <input
        type="range"
        min={0}
        max={last}
        value={end}
        aria-label="Fin del zoom"
        aria-valuetext={format(keys[end])}
        onChange={(e) => onChange(windowFromIndices(keys, start, Math.max(Number(e.target.value), start + 1)))}
        className={thumb}
      />
    </div>
  );
}
