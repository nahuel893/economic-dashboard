/**
 * Optional context drawn over the history charts. Each layer is independent,
 * so several can be on at once; the active ones live in the URL (`?marcas=`).
 */

/** A period between two plain dates (YYYY-MM-DD); `to` is null while it lasts. */
export type Span = {
  /** Short text drawn on the chart. */
  label: string;
  /** Full text for the tooltip. */
  name: string;
  from: string;
  to: string | null;
};

export type MarkLayerKey = "presidencias";

export type MarkLayer = { key: MarkLayerKey; label: string; spans: Span[] };

/** Each term starts on the day of the inauguration. */
const PRESIDENCIES: Span[] = [
  { label: "Duhalde", name: "Eduardo Duhalde", from: "2002-01-02", to: "2003-05-25" },
  { label: "N. Kirchner", name: "Néstor Kirchner", from: "2003-05-25", to: "2007-12-10" },
  { label: "C. Kirchner", name: "Cristina Fernández de Kirchner", from: "2007-12-10", to: "2015-12-10" },
  { label: "Macri", name: "Mauricio Macri", from: "2015-12-10", to: "2019-12-10" },
  { label: "A. Fernández", name: "Alberto Fernández", from: "2019-12-10", to: "2023-12-10" },
  { label: "Milei", name: "Javier Milei", from: "2023-12-10", to: null },
];

export const MARK_LAYERS: MarkLayer[] = [{ key: "presidencias", label: "Presidencias", spans: PRESIDENCIES }];

/** Known layers in the URL value, once each and in registry order. */
export function parseMarks(value: string | undefined): MarkLayerKey[] {
  const asked = new Set(value?.split(",") ?? []);
  return MARK_LAYERS.filter((layer) => asked.has(layer.key)).map((layer) => layer.key);
}

export const serializeMarks = (keys: MarkLayerKey[]) => (keys.length ? keys.join(",") : undefined);

/** A span placed on a chart whose X axis is the list of point dates. */
export type AxisSpan = Span & {
  x1: string;
  x2: string;
  /** Alternates along the layer, fixed per span so it does not change with the window. */
  shade: 0 | 1;
  /** Whether the span starts inside the window, where a boundary line goes. */
  edge: boolean;
};

/** Approximate advance of one character at the 10px label size, plus side padding. */
const LABEL_CHAR_WIDTH = 5.6;
const LABEL_PADDING = 8;

/** Whether a label fits over a span drawn `width` pixels wide. */
export const labelFits = (label: string, width: number) => label.length * LABEL_CHAR_WIDTH + LABEL_PADDING <= width;

/**
 * Places spans on a category axis. Each one runs from the first point on or
 * after its start to the first point on or after its end (or the last point),
 * so consecutive spans share a boundary and leave no gap.
 */
export function spansOnAxis(spans: Span[], dates: string[]): AxisSpan[] {
  if (dates.length < 2) return [];
  const last = dates.length - 1;
  const firstFrom = (date: string) => {
    const index = dates.findIndex((d) => d >= date);
    return index === -1 ? last : index;
  };

  return spans.flatMap((span, i) => {
    if (span.from > dates[last] || (span.to !== null && span.to <= dates[0])) return [];
    const start = firstFrom(span.from);
    const end = span.to === null ? last : firstFrom(span.to);
    if (end <= start) return [];
    return [
      {
        ...span,
        x1: dates[start],
        x2: dates[end],
        shade: (i % 2) as 0 | 1,
        edge: start > 0,
      },
    ];
  });
}

/** The span a date falls in, if any. */
export const spanAt = (spans: Span[], date: string) =>
  spans.find((span) => date >= span.from && (span.to === null || date < span.to));

/**
 * Spans already placed on an axis, placed again on a subset of its dates (a
 * zoomed chart). Each keeps its shading, so bands do not swap shades on zoom.
 */
export function placeAgain<T extends AxisSpan>(spans: T[], dates: string[]): T[] {
  return spans.flatMap((span) => spansOnAxis([span], dates).map((placed) => ({ ...span, ...placed, shade: span.shade })));
}
