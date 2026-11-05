import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

import { citationParts } from "@/lib/sources/citations";
import { INDEC_SERIES, SOURCES } from "@/lib/sources/clients";
import { MACRO_SOURCES } from "./macro";
import { IPC_REGION_SERIES, WAGES_URL } from "@/lib/sources/maps";
import povertySnapshot from "@/lib/sources/snapshots/eph-poverty.json";
import unemploymentSnapshot from "@/lib/sources/snapshots/eph-unemployment.json";
import { REGIONS } from "./geography";
import { historyReferences, homeReferences, mapsReferences } from "./references";

const details = (refs: ReturnType<typeof homeReferences>, id: string) =>
  refs.find((ref) => ref.id === id)!.items.map((item) => item.detail);

describe("citationParts", () => {
  it("splits a combined citation and links each known source", () => {
    expect(citationParts(SOURCES.dollars)).toEqual([
      { name: "dolarapi.com", id: "dolarapi" },
      { name: "ArgentinaDatos", id: "argentinaDatos" },
    ]);
  });

  it("keeps unknown names without a link", () => {
    expect(citationParts("Otra fuente")).toEqual([{ name: "Otra fuente", id: null }]);
  });
});

describe("homeReferences", () => {
  const refs = homeReferences();

  it("lists every source of the page in order of appearance", () => {
    expect(refs.map((ref) => ref.id)).toEqual(["dolarapi", "argentinaDatos", "bcra", "indec", "byma"]);
  });

  it("names each source as the cards cite it", () => {
    for (const ref of refs) expect(citationParts(ref.name)).toEqual([{ name: ref.name, id: ref.id }]);
  });

  it("documents every BCRA variable and INDEC series shown on the page", () => {
    for (const { source } of MACRO_SOURCES) {
      if (source.kind === "bcra") expect(details(refs, "bcra")).toContain(`Variable ${source.id}`);
      else expect(details(refs, "indec").some((detail) => detail.includes(source.seriesId))).toBe(true);
    }
    expect(details(refs, "bcra")).toEqual(expect.arrayContaining(["Variable 5", "Variable 1187", "Variable 1188"]));
  });
});

describe("historyReferences", () => {
  const refs = historyReferences();

  it("lists only the sources of the history page, in order of appearance", () => {
    expect(refs.map((ref) => ref.id)).toEqual(["argentinaDatos", "indec", "bcra"]);
  });

  it("documents both EMAE series and the BCRA variables it charts", () => {
    expect(details(refs, "indec").join(" ")).toContain(INDEC_SERIES.emae);
    expect(details(refs, "indec").join(" ")).toContain(INDEC_SERIES.emaeSeasonallyAdjusted);
    expect(details(refs, "bcra")).toEqual(["Variable 1", "Variable 7"]);
  });
});

describe("mapsReferences", () => {
  const refs = mapsReferences();
  const urls = (id: string) => refs.find((ref) => ref.id === id)!.items.map((item) => item.url);

  it("lists the sources of the map in the order of its indicators", () => {
    expect(refs.map((ref) => ref.id)).toEqual(["oede", "indecEph", "indec"]);
  });

  it("names each source as the map cites it", () => {
    expect(refs.map((ref) => ref.name)).toEqual(["OEDE (SIPA)", "INDEC, EPH", "INDEC vía datos.gob.ar"]);
    for (const ref of refs) expect(citationParts(ref.name)).toEqual([{ name: ref.name, id: ref.id }]);
  });

  it("links the wage workbook and the INDEC files the snapshots were built from", () => {
    expect(urls("oede")).toEqual([WAGES_URL]);
    expect(urls("indecEph")).toEqual([...povertySnapshot.sources, ...unemploymentSnapshot.sources]);
  });

  it("documents the IPC series of every region", () => {
    expect(details(refs, "indec")).toEqual(REGIONS.map((r) => `Serie ${IPC_REGION_SERIES[r.id]} (nivel general)`));
  });
});
