import { describe, expect, it } from "vitest";
import type { SepaBranchesFile, SepaProduct } from "@/lib/sources/sepa-format";
import { buildPriceView, buildSearchIndex, normalizeText, searchProducts } from "./prices";

const PRODUCTS: SepaProduct[] = [
  ["7791337007253", "Leche chocolatada Cindor x 1L", "CINDOR", 0, 3, 359200, 460000],
  ["7790742067005", "DULCE DE LECHE REPOSTERO LA SERENISIMA POT 400 GRM", "LA SERENISIMA", 3, 2, 371000, 555000],
  ["7790895000232", "Gaseosa cola Coca-Cola lata 354 cc", "COCA COLA", 5, 1, 120050, 120050],
  ["7790070411709", "Café molido Cabrales 500 g", "CABRALES", 6, 1, 990000, 990000],
];
const INDEX = buildSearchIndex(PRODUCTS);

describe("normalizeText", () => {
  it("lowercases, drops accents and turns punctuation into spaces", () => {
    expect(normalizeText("  Café   MOLIDO, Coca-Cola 2.25L ")).toBe("cafe molido coca cola 2 25l");
  });
});

describe("searchProducts", () => {
  it("matches every word as the start of a word in the name or brand, most widely sold first", () => {
    expect(searchProducts(PRODUCTS, INDEX, "lech").map((h) => h.ean)).toEqual(["7791337007253", "7790742067005"]);
    expect(searchProducts(PRODUCTS, INDEX, "leche seren").map((h) => h.ean)).toEqual(["7790742067005"]);
    expect(searchProducts(PRODUCTS, INDEX, "eche")).toEqual([]);
  });

  it("puts products whose name starts with the first word ahead, keeping the store order within each group", () => {
    expect(searchProducts(PRODUCTS, INDEX, "leche serenisima").map((h) => h.ean)).toEqual(["7790742067005"]);
    const products: SepaProduct[] = [
      ["1", "DULCE DE LECHE LA SERENISIMA", "LA SERENISIMA", 0, 9, 1, 1],
      ["2", "LECHE ENTERA LA SERENISIMA", "LA SERENISIMA", 9, 8, 1, 1],
      ["3", "CREMA DE LECHE LA SERENISIMA", "LA SERENISIMA", 17, 7, 1, 1],
      ["4", "LECHE DESCREMADA LA SERENISIMA", "LA SERENISIMA", 24, 6, 1, 1],
    ];
    const index = buildSearchIndex(products);
    expect(searchProducts(products, index, "leche serenisima").map((h) => h.ean)).toEqual(["2", "4", "1", "3"]);
    expect(searchProducts(products, index, "leche serenisima", 3).map((h) => h.ean)).toEqual(["2", "4", "1"]);
  });

  it("ignores accents and case in the query", () => {
    expect(searchProducts(PRODUCTS, INDEX, "CAFÉ cabrales").map((h) => h.ean)).toEqual(["7790070411709"]);
    expect(searchProducts(PRODUCTS, INDEX, "cafe").map((h) => h.ean)).toEqual(["7790070411709"]);
  });

  it("finds a product by the start of its barcode", () => {
    expect(searchProducts(PRODUCTS, INDEX, "77908950").map((h) => h.ean)).toEqual(["7790895000232"]);
  });

  it("returns hits in pesos with their store count, up to the limit", () => {
    expect(searchProducts(PRODUCTS, INDEX, "leche", 1)).toEqual([
      { ean: "7791337007253", name: "Leche chocolatada Cindor x 1L", brand: "CINDOR", stores: 3, min: 3592, max: 4600 },
    ]);
  });

  it("needs at least two characters", () => {
    expect(searchProducts(PRODUCTS, INDEX, "l")).toEqual([]);
    expect(searchProducts(PRODUCTS, INDEX, "  ")).toEqual([]);
  });
});

describe("buildPriceView", () => {
  const branches: SepaBranchesFile = {
    chains: ["Coto", "Disco"],
    branches: [
      [0, "Coto Palermo", "Av. Bullrich 345", "CABA", "Ciudad de Buenos Aires", -58.42, -34.57],
      [1, "Disco Nueva Córdoba", "Obispo Trejo 1200", "Córdoba", "Córdoba", -64.18, -31.42],
      [1, "Disco Centro", "Colón 100", "Córdoba", "Córdoba", -64.19, -31.41],
    ],
  };

  it("places every branch with its price, cheapest first, with the summary and color classes", () => {
    const view = buildPriceView(PRODUCTS[0], [
      { branch: 2, cents: 460000 },
      { branch: 0, cents: 359200 },
      { branch: 1, cents: 400000 },
    ], branches, "2026-11-05");

    expect(view).toMatchObject({ ean: "7791337007253", name: "Leche chocolatada Cindor x 1L", brand: "CINDOR", date: "2026-11-05" });
    expect(view.points.map((p) => [p.name, p.chain, p.price])).toEqual([
      ["Coto Palermo", "Coto", 3592],
      ["Disco Nueva Córdoba", "Disco", 4000],
      ["Disco Centro", "Disco", 4600],
    ]);
    expect(view.points[0]).toMatchObject({ address: "Av. Bullrich 345", locality: "CABA", province: "Ciudad de Buenos Aires", lon: -58.42, lat: -34.57 });
    expect(view.summary).toEqual({ min: 3592, median: 4000, max: 4600, stores: 3, chains: 2 });
    expect(view.classes.map((c) => [c.from, c.to])).toEqual([[3592, 3592], [4000, 4000], [4600, 4600]]);
    expect(new Set(view.points.map((p) => p.color)).size).toBe(3);
  });

  it("takes the median of an even count as the mean of the middle two", () => {
    const view = buildPriceView(PRODUCTS[1], [{ branch: 0, cents: 371000 }, { branch: 1, cents: 555000 }], branches, "2026-11-05");
    expect(view.summary.median).toBe(4630);
  });
});
