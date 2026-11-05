import { describe, expect, it } from "vitest";
import { labelFits, MARK_LAYERS, parseMarks, placeAgain, serializeMarks, spansOnAxis, type Span } from "./marks";

describe("parseMarks", () => {
  it("keeps known layers once, ignoring unknown ones", () => {
    expect(parseMarks("presidencias")).toEqual(["presidencias"]);
    expect(parseMarks("presidencias,foo,presidencias")).toEqual(["presidencias"]);
    expect(parseMarks("foo")).toEqual([]);
    expect(parseMarks(undefined)).toEqual([]);
  });
});

describe("serializeMarks", () => {
  it("joins the active layers, or nothing when none is on", () => {
    expect(serializeMarks(["presidencias"])).toBe("presidencias");
    expect(serializeMarks([])).toBeUndefined();
  });
});

describe("presidencies", () => {
  const spans = MARK_LAYERS.find((layer) => layer.key === "presidencias")!.spans;

  it("cover the history without gaps or overlaps", () => {
    spans.slice(1).forEach((span, i) => expect(span.from).toBe(spans[i].to));
    expect(spans[0].from <= "2003-01-01").toBe(true);
    expect(spans.at(-1)!.to).toBeNull();
  });
});

describe("spansOnAxis", () => {
  const spans: Span[] = [
    { label: "A", name: "Presidente A", from: "2019-12-10", to: "2023-12-10" },
    { label: "B", name: "Presidente B", from: "2023-12-10", to: null },
  ];
  const monthEnds = ["2023-10-31", "2023-11-30", "2023-12-31", "2024-01-31", "2024-02-29"];

  it("snaps each span to the first point on or after its start, so neighbours touch", () => {
    expect(spansOnAxis(spans, monthEnds)).toMatchObject([
      { label: "A", x1: "2023-10-31", x2: "2023-12-31", shade: 0, edge: false },
      { label: "B", x1: "2023-12-31", x2: "2024-02-29", shade: 1, edge: true },
    ]);
  });

  it("drops spans outside the window and keeps each span's shade stable", () => {
    const result = spansOnAxis(spans, ["2024-01-31", "2024-02-29"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ label: "B", x1: "2024-01-31", shade: 1, edge: false });
  });

  it("returns nothing for fewer than two points", () => {
    expect(spansOnAxis(spans, ["2024-01-31"])).toEqual([]);
  });
});

describe("labelFits", () => {
  it("is true when the span is wide enough for its label", () => {
    expect(labelFits("Milei", 50)).toBe(true);
    expect(labelFits("A. Fernández", 50)).toBe(false);
    expect(labelFits("A. Fernández", 90)).toBe(true);
  });
});

describe("placeAgain", () => {
  const dates = ["2015-01-01", "2016-01-01", "2017-01-01", "2018-01-01", "2019-01-01", "2020-01-01"];
  const placed = spansOnAxis(MARK_LAYERS[0].spans.slice(2, 5), dates).map((span) => ({ ...span, layer: "presidencias" as const, row: 0 }));

  it("snaps the spans to the visible dates, keeping their shading and extra fields", () => {
    const zoomed = placeAgain(placed, dates.slice(1, 4));
    expect(zoomed.map((s) => [s.label, s.x1, s.x2, s.edge])).toEqual([
      ["Macri", "2016-01-01", "2018-01-01", false],
    ]);
    expect(zoomed[0].shade).toBe(placed.find((s) => s.label === "Macri")!.shade);
    expect(zoomed[0]).toMatchObject({ layer: "presidencias", row: 0 });
  });
});
