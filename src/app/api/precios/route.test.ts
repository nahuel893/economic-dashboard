import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { searchSepa } = vi.hoisted(() => ({ searchSepa: vi.fn() }));
vi.mock("@/lib/sources/prices", () => ({ searchSepa }));

import { GET } from "./route";

const request = (query: string) => new NextRequest(`http://localhost/api/precios${query}`);

afterEach(() => {
  searchSepa.mockReset();
  vi.restoreAllMocks();
});

describe("GET /api/precios", () => {
  it("answers the search with the day and its hits, cacheable for a while", async () => {
    const result = { date: "2026-11-05", hits: [{ ean: "1", name: "Leche", brand: "X", stores: 3, min: 1, max: 2 }] };
    searchSepa.mockResolvedValue(result);
    const response = await GET(request("?q=leche"));
    expect(searchSepa).toHaveBeenCalledWith("leche");
    expect(await response.json()).toEqual(result);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=900");
  });

  it("searches an empty query when q is missing, and cuts long queries", async () => {
    searchSepa.mockResolvedValue({ date: "2026-11-05", hits: [] });
    await GET(request(""));
    await GET(request(`?q=${"a".repeat(200)}`));
    expect(searchSepa.mock.calls).toEqual([[""], ["a".repeat(80)]]);
  });

  it("answers 503 with a message when the SEPA files cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    searchSepa.mockRejectedValue(new Error("GET github.com responded 502"));
    const response = await GET(request("?q=leche"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Los precios de SEPA no están disponibles en este momento." });
  });
});
