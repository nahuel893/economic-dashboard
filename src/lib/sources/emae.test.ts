import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseIndecEmae } from "./emae";
import { readXls, type XlsRows } from "./xls";

// INDEC's sh_emae_mensual_base2004.xls as published on 2026-11-24 (data up to September 2026).
const fixture = () => readXls(new Uint8Array(readFileSync(new URL("./__fixtures__/indec-emae.xls", import.meta.url))));

describe("readXls", () => {
  it("reads the numbers and texts of the first worksheet", () => {
    const rows = fixture();
    expect(rows[2][0]).toBe("Período");
    expect(rows[2][2]).toContain("Serie Original");
    expect(rows[4][0]).toBe(2004);
    expect(rows[4][1]).toBe("Enero");
    expect(rows[4][2]).toBe(92.62750602691052);
    expect(rows[276][1]).toBe("Septiembre");
    expect(rows[276][6]).toBe(153.50858240802057);
  });

  it("rejects a file that is not a binary workbook", () => {
    expect(() => readXls(new TextEncoder().encode("<html>not found</html>"))).toThrow("Not an OLE2 compound file");
  });
});

describe("parseIndecEmae", () => {
  it("returns the three series, one point per month at month end, from January 2004", () => {
    const emae = parseIndecEmae(fixture());
    for (const series of [emae.original, emae.seasonallyAdjusted, emae.trendCycle]) {
      expect(series).toHaveLength(273);
      expect(series[0].date).toBe("2004-01-31");
      expect(series.at(-1)!.date).toBe("2026-09-30");
    }
    expect(emae.original[0].value).toBe(92.62750602691052);
    expect(emae.seasonallyAdjusted[0].value).toBe(98.52855926508813);
    expect(emae.trendCycle[0].value).toBe(96.05881934361786);
    expect(emae.original.at(-1)!.value).toBe(149.8836064015637);
    expect(emae.seasonallyAdjusted.at(-1)!.value).toBe(152.17402250341325);
    expect(emae.trendCycle.at(-1)!.value).toBe(153.50858240802057);
  });

  const header: XlsRows = [
    ["Estimador Mensual de Actividad Económica"],
    [],
    ["Período", undefined!, "Índice Serie Original", "Var", "Índice Serie Desestacionalizada", "Var", "Índice Serie Tendencia-Ciclo", "Var"],
    [],
  ];

  it("fails when the columns are not the expected ones", () => {
    const moved = structuredClone(header);
    moved[2][4] = "Índice Serie Tendencia-Ciclo";
    expect(() => parseIndecEmae([...moved, [2004, "Enero", 1, 0, 2, 0, 3]])).toThrow("EMAE columns changed");
  });

  it("fails when a month is skipped", () => {
    const rows = [...header, [2004, "Enero", 1, 0, 2, 0, 3], [undefined!, "Marzo", 1, 0, 2, 0, 3]];
    expect(() => parseIndecEmae(rows as XlsRows)).toThrow("expected Febrero 2004");
  });

  it("fails without data rows", () => {
    expect(() => parseIndecEmae(header)).toThrow("EMAE workbook has no data");
  });
});
