import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { firstSymbolLayer, withoutIslandLabels } from "./basemap";

const style = {
  version: 8,
  sources: {},
  layers: [
    { id: "background", type: "background" },
    { id: "water_name", type: "symbol", source: "openmaptiles", "source-layer": "water_name", layout: {} },
    { id: "label_other", type: "symbol", source: "openmaptiles", "source-layer": "place", filter: ["==", ["get", "class"], "island"], layout: {} },
    { id: "label_country_1", type: "symbol", source: "openmaptiles", "source-layer": "place", layout: {} },
  ],
} as StyleSpecification;

describe("withoutIslandLabels", () => {
  const result = withoutIslandLabels(style);
  const filterOf = (id: string) => result.layers.find((l) => l.id === id) as { filter?: unknown };

  it("keeps each place label layer's own filter and drops the islands' names", () => {
    expect(filterOf("label_other").filter).toEqual([
      "all",
      ["==", ["get", "class"], "island"],
      expect.arrayContaining(["!"]),
    ]);
    expect(JSON.stringify(filterOf("label_country_1").filter)).toContain("Falkland Islands");
    expect(JSON.stringify(filterOf("label_country_1").filter)).toContain("Islas Malvinas");
  });

  it("also drops the basemap's English names for the other South Atlantic islands", () => {
    const filter = JSON.stringify(filterOf("label_country_1").filter);
    expect(filter).toContain("South Georgia and the South Sandwich Islands");
    expect(filter).toContain('["get","iso_a2"],"GS"');
  });

  it("leaves other layers and the input untouched", () => {
    expect(filterOf("water_name").filter).toBeUndefined();
    expect((style.layers[2] as { filter: unknown }).filter).toEqual(["==", ["get", "class"], "island"]);
  });
});

describe("firstSymbolLayer", () => {
  it("is the id of the first label layer, so data layers go under the basemap labels", () => {
    expect(firstSymbolLayer(style)).toBe("water_name");
  });
});
