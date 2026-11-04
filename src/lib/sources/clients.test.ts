import { beforeEach, describe, expect, it, vi } from "vitest";

const { cacheLife, fetchJson } = vi.hoisted(() => ({ cacheLife: vi.fn(), fetchJson: vi.fn() }));
vi.mock("next/cache", () => ({ cacheLife }));
vi.mock("./http", () => ({ fetchJson }));

import { CACHE, getBymaIndex, getIndecMonthlySeries } from "./clients";

const merval = {
  date: "2026-11-03",
  symbol: "MMSCI",
  description: "S&P Merval",
  price: 2_000_000,
  previousClosingPrice: 1_900_000,
  variation: 0.05,
  highValue: 2_010_000,
  minValue: 1_950_000,
};

describe("cached clients", () => {
  beforeEach(() => {
    cacheLife.mockReset();
    fetchJson.mockReset();
  });

  it("returns the parsed data and caches it for the source's lifetime", async () => {
    fetchJson.mockResolvedValue({ data: [merval] });
    await expect(getBymaIndex("MMSCI")).resolves.toMatchObject({ name: "S&P Merval", value: 2_000_000 });
    expect(cacheLife).toHaveBeenCalledWith(CACHE.live);
  });

  it("rejects with the original message, outside the cache, and keeps the failure briefly", async () => {
    fetchJson.mockResolvedValue({ data: [] });
    await expect(getBymaIndex("MMSCI")).rejects.toThrow("BYMA index MMSCI not found");
    expect(cacheLife).toHaveBeenCalledWith(expect.objectContaining({ revalidate: 60 }));
    expect(cacheLife).not.toHaveBeenCalledWith(CACHE.live);
  });

  it("reports network errors the same way", async () => {
    fetchJson.mockRejectedValue(new Error("GET apis.datos.gob.ar responded 503"));
    await expect(getIndecMonthlySeries(["x"])).rejects.toThrow("responded 503");
  });

  it("dates monthly INDEC series at the end of each month", async () => {
    fetchJson.mockResolvedValue({ data: [["2023-12-01", 150.2]] });
    await expect(getIndecMonthlySeries(["x"])).resolves.toEqual([[{ date: "2023-12-31", value: 150.2 }]]);
  });
});
