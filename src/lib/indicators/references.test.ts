import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

import { citationParts } from "@/lib/sources/citations";
import { INDEC_SERIES, SOURCES } from "@/lib/sources/clients";
import { MACRO_SOURCES } from "./macro";
import { historyReferences, homeReferences } from "./references";

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
