/**
 * Short source names cited on cards and charts, and the anchors of their full
 * reference at the bottom of the page. Client-safe: no data fetching here.
 */
export type SourceId = "dolarapi" | "argentinaDatos" | "bcra" | "indec" | "byma" | "oede" | "indecEph" | "indecOpex" | "indecCenso" | "sepa";

export const SOURCE_NAMES: Record<SourceId, string> = {
  dolarapi: "dolarapi.com",
  argentinaDatos: "ArgentinaDatos",
  bcra: "BCRA",
  indec: "INDEC vía datos.gob.ar",
  byma: "BYMA",
  oede: "OEDE (SIPA)",
  indecEph: "INDEC, EPH",
  indecOpex: "INDEC, OPEX",
  indecCenso: "INDEC, Censo 2022",
  sepa: "SEPA",
};

/** Separator between sources when one value combines several. */
export const CITATION_SEPARATOR = " · ";

export const sourceAnchor = (id: SourceId) => `fuente-${id}`;

const ID_BY_NAME = new Map(Object.entries(SOURCE_NAMES).map(([id, name]) => [name, id as SourceId]));

/** Splits a citation into its sources; names without a reference keep `id: null`. */
export function citationParts(citation: string): { name: string; id: SourceId | null }[] {
  return citation.split(CITATION_SEPARATOR).map((name) => ({ name, id: ID_BY_NAME.get(name) ?? null }));
}
