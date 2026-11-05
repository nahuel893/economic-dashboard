import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGLOMERADOS, AREAS } from "@/lib/indicators/geography";
import opexRows from "./__fixtures__/opex-semesters.json";
import {
  ephPovertySeries,
  findWageWorkbookUrl,
  findOedeWorkbookUrl,
  parseBcraProvinceBalances,
  parseEphQuarterly,
  censusSeries,
  parseOedeEmployment,
  parseOedeWages,
  parseOpexSemesters,
  regionalInflation,
} from "./map-parsers";

const utc = (y: number, m: number, d = 1) => new Date(Date.UTC(y, m - 1, d));

/** OEDE province rows in sheet order, as the "Total" sheet spells them. */
const OEDE_NAMES = [
  "GRAN BUENOS AIRES", "CAPITAL FEDERAL", "BUENOS AIRES", "CATAMARCA", "CORDOBA", "CORRIENTES", "CHACO", "CHUBUT",
  "ENTRE RIOS", "FORMOSA", "JUJUY", "LA PAMPA", "LA RIOJA", "MENDOZA", "MISIONES", "NEUQUEN", "RIO NEGRO", "SALTA",
  "SAN JUAN", "SAN LUIS", "SANTA CRUZ", "SANTA FE", "SANTIAGO DEL ESTERO", "TUCUMAN", "TIERRA DEL FUEGO",
];

function oedeSheet(names = OEDE_NAMES) {
  return [
    ["Remuneración promedio de los trabajadores registrados del sector privado"],
    [],
    ["Provincia", utc(2026, 4, 11), utc(2026, 5, 11), utc(2026, 6, 11), null],
    ...names.map((name, i) => [name, 100 + i, "s.d.", 300 + i, null]),
    ["Total", 1, 2, 3],
    ["Fuente: STEySS, en base a SIPA."],
  ];
}

describe("parseOedeWages", () => {
  it("keys each OEDE row by map area and marks the aguinaldo months", () => {
    const series = parseOedeWages(oedeSheet(), 36);
    expect(series.periods.map((p) => [p.period, p.note])).toEqual([
      ["2026-04", undefined],
      ["2026-06", "Incluye aguinaldo"],
    ]);
    const june = series.periods[1].values;
    expect(Object.keys(june).sort()).toEqual(AREAS.map((a) => a.id).sort());
    expect(june["06-gba"]).toEqual({ value: 300 });
    expect(june["02"]).toEqual({ value: 301 });
    expect(june["06-resto"]).toEqual({ value: 302 });
    expect(june["14"]).toEqual({ value: 304 });
    expect(june["94"]).toEqual({ value: 324 });
    expect(series.periods[0].values["90"]).toEqual({ value: 123 });
  });

  it("keeps only the most recent months", () => {
    expect(parseOedeWages(oedeSheet(), 1).periods.map((p) => p.period)).toEqual(["2026-06"]);
  });

  it("fails on a row it cannot place on the map", () => {
    expect(() => parseOedeWages(oedeSheet([...OEDE_NAMES, "ISLAS DEL ATLANTICO"]), 36)).toThrow(
      'OEDE wages: unknown province row "ISLAS DEL ATLANTICO"',
    );
  });

  it("fails when an area is missing", () => {
    expect(() => parseOedeWages(oedeSheet(OEDE_NAMES.slice(1)), 36)).toThrow("OEDE wages: no row for 06-gba");
  });

  it("fails without the header row", () => {
    expect(() => parseOedeWages([["Provincias"]], 36)).toThrow("OEDE wages: header row not found");
  });
});

describe("findWageWorkbookUrl", () => {
  it("finds the current monthly 2-digit workbook on the index page", () => {
    const html = `<a href="/sites/default/files/provinciales_serie_remuneraciones_mensual_4dig_8.xlsx">x</a>
      <a href="/sites/default/files/provinciales_serie_remuneraciones_mensual_2dig_10.xlsx">y</a>`;
    expect(findWageWorkbookUrl(html)).toBe(
      "https://www.argentina.gob.ar/sites/default/files/provinciales_serie_remuneraciones_mensual_2dig_10.xlsx",
    );
  });

  it("returns null when the page does not link it", () => {
    expect(findWageWorkbookUrl("<html></html>")).toBeNull();
  });
});

describe("regionalInflation", () => {
  const months = ["2025-01-01", "2025-02-01", "2025-12-01", "2026-01-01", "2026-02-01"];
  const levels = (base: number) => months.map((date, i) => ({ date, value: base * [100, 102, 120, 125, 130][i] }));

  it("computes monthly and year-on-year change per region from index levels", () => {
    const { monthly, yearOnYear } = regionalInflation([1, 1, 1, 1, 1, 2].map(levels), 36);
    expect(monthly.periods.map((p) => p.period)).toEqual(["2025-02", "2026-01", "2026-02"]);
    expect(monthly.periods[1].values.GBA.value).toBeCloseTo(4.1667, 4);
    expect(monthly.periods[2].values.Patagonia.value).toBeCloseTo(4, 6);
    expect(Object.keys(monthly.periods[2].values)).toEqual(["GBA", "Pampeana", "NOA", "NEA", "Cuyo", "Patagonia"]);
    expect(yearOnYear.periods.map((p) => p.period)).toEqual(["2026-01", "2026-02"]);
    expect(yearOnYear.periods[0].values.NOA.value).toBeCloseTo(25, 6);
    expect(yearOnYear.periods[1].values.Cuyo.value).toBeCloseTo(27.451, 3);
  });

  it("keeps only the most recent months", () => {
    expect(regionalInflation([1, 1, 1, 1, 1, 1].map(levels), 1).monthly.periods.map((p) => p.period)).toEqual([
      "2026-02",
    ]);
  });
});

/** An EPH table row for each aglomerado, in the XLS's own spelling. */
const EPH_NAMES: Record<string, string> = {
  "2": "Gran La Plata",
  "3": "Bahía Blanca - Cerri",
  "4": "Gran Rosario",
  "5": "Gran Santa Fe",
  "6": "Gran Paraná",
  "7": "Posadas",
  "8": "Gran Resistencia ",
  "9": "Comodoro Rivadavia-Rada Tilly",
  "10": "Gran Mendoza",
  "12": "Corrientes ",
  "13": "Gran Córdoba",
  "14": "Concordia",
  "15": "Formosa",
  "17": "Neuquén-Plottier",
  "18": "Santiago del Estero - La Banda",
  "19": "Jujuy - Palpalá",
  "20": "Río Gallegos",
  "22": "Gran Catamarca",
  "23": "Salta",
  "25": "La Rioja",
  "26": "Gran San Luis",
  "27": "Gran San Juan",
  "29": "Gran Tucumán-Tafí Viejo",
  "30": "Santa Rosa - Toay",
  "31": "Ushuaia - Río Grande ",
  "32": "Ciudad Autónoma de Buenos Aires",
  "33": "Partidos del GBA",
  "34": "MAR DEL PLATA",
  "36": "Río Cuarto",
  "38": "San Nicolás - Villa Constitución",
  "91": "Rawson - Trelew",
  "93": "Viedma - Carmen de Patagones",
};

const codes = AGLOMERADOS.map((a) => a.code);

/** Cuadro 4.1 / 4.2 of the poverty report: one half-year, households and persons with CVs. */
function povertyTable(title: string, n: number, extra: unknown[][] = []) {
  return [
    [`Cuadro 4.1. Incidencia de la pobreza en hogares y personas. Total 31 aglomerados urbanos. ${title}*`],
    [],
    ["Área geográfica", "Hogares", null, null, null, "Personas", null, null],
    [null, "Total (en miles)", "Incidencia", "CV", null, "Total (en miles)", "Incidencia", "CV"],
    ["Total 31 aglomerados urbanos ", 2498, 24.4, 2.7, null, 9729, 32.3, 2.7],
    ["Regiones"],
    ["Gran Buenos Aires", 1356, 24.9, 4.5, null, 5221, 32.1, 4.6],
    ...codes.map((code, i) => [EPH_NAMES[code], 10, n + i, 5, null, 40, n + 100 + i, 6]),
    ...extra,
    ["Total Aglomerados de 500.000 y más habitantes", 2017, 24.1, 3.2, null, 7815, 31.7, 3.3],
    ["Nota: las estimaciones que tengan asociados coeficientes de variación entre el 16% y el 25%..."],
    ["Fuente: INDEC. Encuesta Permanente de Hogares."],
  ];
}

describe("ephPovertySeries", () => {
  it("builds the four variants per aglomerado, one period per release, in ascending order", () => {
    const series = ephPovertySeries([
      { poverty: povertyTable("Primer semestre de 2026", 20), indigence: povertyTable("Primer semestre de 2026", 1) },
      { poverty: povertyTable("Segundo semestre de 2025", 30), indigence: povertyTable("Segundo semestre de 2025", 2) },
    ]);
    expect(Object.keys(series)).toEqual(["povertyPersons", "povertyHouseholds", "indigencePersons", "indigenceHouseholds"]);
    expect(series.povertyPersons.periods.map((p) => p.period)).toEqual(["2025-H2", "2026-H1"]);
    const latest = series.povertyPersons.periods[1].values;
    expect(Object.keys(latest).sort()).toEqual([...codes].sort());
    expect(latest["2"]).toEqual({ value: 120, cv: 6 });
    expect(latest["93"]).toEqual({ value: 151, cv: 6 });
    expect(series.povertyHouseholds.periods[0].values["23"]).toEqual({ value: 48, cv: 5 });
    expect(series.indigencePersons.periods[1].values["34"]).toEqual({ value: 128, cv: 6 });
    expect(series.indigenceHouseholds.periods[0].values["33"]).toEqual({ value: 28, cv: 5 });
  });

  it("fails on a row that is not an aglomerado nor a known aggregate", () => {
    const table = povertyTable("Primer semestre de 2026", 20, [["Gran Bariloche", 1, 2, 3, null, 4, 5, 6]]);
    expect(() => ephPovertySeries([{ poverty: table, indigence: table }])).toThrow(
      'EPH: unknown aglomerado row "Gran Bariloche"',
    );
  });

  it("fails when the poverty and indigence tables cover different half-years", () => {
    expect(() =>
      ephPovertySeries([
        { poverty: povertyTable("Primer semestre de 2026", 20), indigence: povertyTable("Segundo semestre de 2025", 1) },
      ]),
    ).toThrow("EPH: poverty is 2026-H1 but indigence is 2025-H2");
  });

  it("fails when two releases cover the same half-year", () => {
    const release = { poverty: povertyTable("Primer semestre de 2026", 20), indigence: povertyTable("Primer semestre de 2026", 1) };
    expect(() => ephPovertySeries([release, release])).toThrow("EPH: half-year 2026-H1 appears twice");
  });
});

/** Cuadro 1.8 of the EPH labor-market report: one column per quarter, years spanning their quarters. */
function unemploymentTable() {
  return [
    ["1.8. Tasa de desocupación. Segundo trimestre de 2016-segundo trimestre de 2026"],
    [],
    ["Área geográfica", "Año 2025", null, null, null, null, "Año 2026", null],
    [null, "Trimestre", null, null, null, null, "Trimestre", null],
    [null, "1°", "2°", "3° (3)", "4°", null, "1°", "2°*"],
    [],
    ["Total 31 aglomerados urbanos", 7.9, 7.6, 6.6, 7.5, null, 7.8, 7.9],
    ["Regiones"],
    ["Partidos del Gran Buenos Aires", 10, 11, 12, 13, null, 14, 15],
    ...codes
      .filter((code) => code !== "33")
      .map((code, i) => [EPH_NAMES[code], i, i, code === "93" ? "///" : i, i, null, i, i + 0.5]),
    ["Total aglomerados de menos de 500.000 habitantes", 5.9, 4.6, 4.8, 5, null, 5.2, 5.3],
    ["(3) En el tercer trimestre 2025, el aglomerado de Viedma-Carmen de Patagones presenta una cantidad insuficiente de casos."],
  ];
}

describe("parseEphQuarterly", () => {
  it("reads one period per quarter column, keyed by aglomerado", () => {
    const series = parseEphQuarterly(unemploymentTable(), 12);
    expect(series.periods.map((p) => p.period)).toEqual(["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"]);
    expect(Object.keys(series.periods[5].values).sort()).toEqual([...codes].sort());
    expect(series.periods[5].values["33"]).toEqual({ value: 15 });
    expect(series.periods[5].values["2"]).toEqual({ value: 0.5 });
    expect(series.periods[0].values["93"]).toEqual({ value: 30 });
    expect(series.periods[2].values["93"]).toBeUndefined();
  });

  it("keeps only the most recent quarters", () => {
    expect(parseEphQuarterly(unemploymentTable(), 2).periods.map((p) => p.period)).toEqual(["2026-Q1", "2026-Q2"]);
  });

  it("fails when an aglomerado row is missing", () => {
    const table = unemploymentTable().filter((row) => row[0] !== "Gran Rosario");
    expect(() => parseEphQuarterly(table, 12)).toThrow("EPH: no row for aglomerado 4 (Gran Rosario)");
  });
});

/** Quarter headers as OEDE spells them, with the ordinal sign of the first quarters and the degree sign of the rest. */
const QUARTERS = ["1º Trim 2025", "2° Trim 2025", "3° Trim 2025", "4° Trim 2025", "1° Trim 2026", "2° Trim 2026"];

/** One province sheet of the quarterly employment workbook: a header, sector rows and a TOTAL row. */
function employmentSheet(base: number, missingLast = false) {
  const total = QUARTERS.map((_, q) => (missingLast && q === QUARTERS.length - 1 ? "s.d." : base + 10 * q));
  return [
    ["Province name"],
    ["Empleo. Asalariados registrados del sector privado por rama de actividad"],
    [null, "Ramas de actividad", ...QUARTERS],
    ["A", "AGRICULTURA", ...QUARTERS.map(() => 5)],
    [null, "TOTAL", ...total],
    ["Fuente: STEySS, en base a SIPA."],
  ];
}

const employmentSheets = (missing?: string) =>
  Object.fromEntries(AREAS.map((a, i) => [a.id, employmentSheet(1000 + 100 * i, a.id === missing)]));

describe("parseOedeEmployment", () => {
  it("reads each province's TOTAL row by quarter, keyed by map area", () => {
    const { jobs } = parseOedeEmployment(employmentSheets(), 36);
    expect(jobs.periods.map((p) => p.period)).toEqual(["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"]);
    const last = jobs.periods[5].values;
    expect(Object.keys(last).sort()).toEqual(AREAS.map((a) => a.id).sort());
    expect(last["06-gba"]).toEqual({ value: 1150 });
    expect(last["06-resto"]).toEqual({ value: 1250 });
    expect(last["94"]).toEqual({ value: 3450 });
  });

  it("computes the year-on-year change against the same quarter a year earlier", () => {
    const { yearOnYear } = parseOedeEmployment(employmentSheets(), 36);
    expect(yearOnYear.periods.map((p) => p.period)).toEqual(["2026-Q1", "2026-Q2"]);
    // "06-gba" is the second area: 1100 + 10 * 5 = 1150 against 1100 + 10 * 1 = 1110.
    expect(yearOnYear.periods[1].values["06-gba"].value).toBeCloseTo((1150 / 1110 - 1) * 100, 10);
  });

  it("keeps only the most recent quarters in both variants", () => {
    const { jobs, yearOnYear } = parseOedeEmployment(employmentSheets(), 1);
    expect(jobs.periods.map((p) => p.period)).toEqual(["2026-Q2"]);
    expect(yearOnYear.periods.map((p) => p.period)).toEqual(["2026-Q2"]);
  });

  it("leaves an area without a value for a quarter with a missing cell", () => {
    const { jobs, yearOnYear } = parseOedeEmployment(employmentSheets("14"), 36);
    expect(jobs.periods[5].values["14"]).toBeUndefined();
    expect(jobs.periods[4].values["14"]).toBeDefined();
    expect(yearOnYear.periods[1].values["14"]).toBeUndefined();
    expect(yearOnYear.periods[1].values["10"]).toBeDefined();
  });

  it("fails when an area has no sheet", () => {
    const rest = employmentSheets();
    delete rest["06-gba"];
    expect(() => parseOedeEmployment(rest, 36)).toThrow("OEDE employment: no sheet for 06-gba");
  });

  it("fails when a sheet has no quarter header or no TOTAL row", () => {
    expect(() => parseOedeEmployment({ ...employmentSheets(), "02": [["x"]] }, 36)).toThrow(
      "OEDE employment: header row not found in the sheet of 02",
    );
    expect(() =>
      parseOedeEmployment({ ...employmentSheets(), "02": employmentSheet(1).filter((r) => r[1] !== "TOTAL") }, 36),
    ).toThrow("OEDE employment: TOTAL row not found in the sheet of 02");
  });
});

describe("findOedeWorkbookUrl", () => {
  it("finds the current quarterly employment workbook, whatever its numeric suffix", () => {
    const html = '<a href="/sites/default/files/provinciales_serie_empleo_trimestral_2dig_9.xlsx">';
    expect(findOedeWorkbookUrl(html, "provinciales_serie_empleo_trimestral_2dig")).toBe(
      "https://www.argentina.gob.ar/sites/default/files/provinciales_serie_empleo_trimestral_2dig_9.xlsx",
    );
  });

  it("returns null when the page does not link it", () => {
    expect(findOedeWorkbookUrl("<html></html>", "provinciales_serie_empleo_trimestral_2dig")).toBeNull();
  });
});

describe("parseBcraProvinceBalances", () => {
  const text = readFileSync(new URL("./__fixtures__/bcra-vol4.txt", import.meta.url), "utf8");

  it("returns private deposits and loans by area and quarter in millions of pesos, pesos and dollars added", () => {
    const { deposits, loans } = parseBcraProvinceBalances(text, 12);
    expect(deposits.periods.map((p) => p.period)).toEqual(["2025-Q1", "2025-Q4", "2026-Q1"]);
    // Series 20329 (pesos) and 20518 (dollars) are the city's private deposits, in thousands of pesos.
    expect(deposits.periods[2].values["02"].value).toBeCloseTo((68155022989.5379 + 30066842464.8681) / 1000, -1);
    expect(loans.periods[2].values["02"].value).toBeCloseTo((37096132424.2438 + 18123554359.0711) / 1000, -1);
    expect(Object.keys(deposits.periods[2].values).sort()).toEqual(AREAS.map((a) => a.id).sort());
  });

  it("splits Buenos Aires into the BCRA's Gran Buenos Aires and the rest of the province", () => {
    const { deposits } = parseBcraProvinceBalances(text, 12);
    const { "06-gba": gba, "06-resto": resto } = deposits.periods[2].values;
    expect(gba.value).toBeCloseTo((8389309151.1057 + 6526718801.59172) / 1000, -1);
    expect(resto.value).toBeCloseTo((9308538091.83654 + 5141827050.67278) / 1000, -1);
  });

  it("computes loans as a percentage of deposits", () => {
    const { deposits, loans, ratio } = parseBcraProvinceBalances(text, 12);
    for (const id of ["02", "06-gba", "94"]) {
      expect(ratio.periods[2].values[id].value).toBeCloseTo(
        (loans.periods[2].values[id].value / deposits.periods[2].values[id].value) * 100,
        8,
      );
    }
  });

  it("keeps only the last quarters asked for", () => {
    expect(parseBcraProvinceBalances(text, 2).loans.periods.map((p) => p.period)).toEqual(["2025-Q4", "2026-Q1"]);
  });

  it("refuses a file whose provinces do not add up to the national total", () => {
    const broken = text.split("\n").map((l) => (l.startsWith("20329;") ? l.replace(/;[^;]*$/, ";1") : l)).join("\n");
    expect(() => parseBcraProvinceBalances(broken, 12)).toThrow(/do not add up/);
  });
});

describe("parseOpexSemesters", () => {
  const { total, yearOnYear } = parseOpexSemesters(opexRows);
  const at = (series: typeof total, period: string) => series.periods.find((p) => p.period === period)!;

  it("reads the first-half exports of each area in millions of USD, one period per year", () => {
    expect(total.periods.map((p) => p.period)).toEqual(
      ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"].map((y) => `${y}-H1`),
    );
    expect(at(total, "2026-H1").values["14"].value).toBeCloseTo(5601.31, 2);
    expect(at(total, "2026-H1").values["02"].value).toBeCloseTo(192.24, 2);
    expect(at(total, "2016-H1").values["58"].value).toBeCloseTo(48.13, 2);
  });

  it("gives both halves of Buenos Aires the province total, with a note, since INDEC does not split it", () => {
    const period = at(total, "2026-H1");
    expect(period.values["06-gba"].value).toBeCloseTo(15965.49, 2);
    expect(period.values["06-resto"]).toEqual(period.values["06-gba"]);
    expect(period.note).toMatch(/Buenos Aires/);
  });

  it("leaves out the totals, regions, foreign and undetermined rows and covers every area", () => {
    const ids = Object.keys(at(total, "2026-H1").values).sort();
    expect(ids).toEqual(AREAS.map((a) => a.id).sort());
  });

  it("flags provisional years and not the final ones", () => {
    expect(at(total, "2025-H1").note).toMatch(/provisorio/);
    expect(at(total, "2023-H1").note ?? "").not.toMatch(/provisorio/);
  });

  it("computes the year-on-year change against the same half of the previous year", () => {
    expect(yearOnYear.periods[0].period).toBe("2017-H1");
    expect(at(yearOnYear, "2026-H1").values["14"].value).toBeCloseTo((5601.3123683 / 5124.3332041 - 1) * 100, 1);
    expect(at(yearOnYear, "2026-H1").values["06-resto"].value).toBeCloseTo((15965.48627299 / 14505.8110917 - 1) * 100, 1);
  });

  it("fails on a province it cannot place", () => {
    const rows = opexRows.map((row) => (row[1] === "Salta" ? [row[0], "Atlantida", ...row.slice(2)] : row));
    expect(() => parseOpexSemesters(rows)).toThrow(/Atlantida/);
  });
});

describe("censusSeries", () => {
  const header = [["Cuadro 2.6. Provincia. Total de población y densidad, por superficie, según departamento. Año 2022"], ["Código", "Departamento", "Superficie en km2", "Año", null]];
  const cordoba = [
    ...header,
    [14, "Total", 164707.8, 3840905, 23.3],
    [14014, "Calamuchita", 4642.5, 56892, 12.3],
    [14021, "Capital", 562, 1505250, 2678.3],
    ["Notas: ...", null, null, null, null],
  ];
  const buenosAires = [...header, ["06", "Total", 305907.4, 17523996, 57.2], ["06", "24 Partidos del Gran Buenos Aires", 3773.3, 10849398, 2875.3], [6028, "Almirante Brown", 129.3, 584827, 4523.0239752513535]];
  const tierraDelFuego = [
    ...header,
    [94, "Total", 910324.4, 185732, 0.2],
    [94028, "Antártida Argentina e Islas del Atlántico Sur", 889626.1, 81, "///"],
    [null, "Antártida Argentina", 873718.4, "///", "///"],
    [94008, "Río Grande", 6567.8, 99241, 15.1],
  ];

  it("reads one value per department, padding the code to INDEC's five digits and rounding the density to one decimal", () => {
    const { population, density } = censusSeries([cordoba, buenosAires]);
    expect(population.periods).toHaveLength(1);
    expect(population.periods[0].period).toBe("2022");
    expect(population.periods[0].values).toEqual({
      "14014": { value: 56892 },
      "14021": { value: 1505250 },
      "06028": { value: 584827 },
    });
    expect(density.periods[0].values["06028"]).toEqual({ value: 4523 });
    expect(density.periods[0].values["14014"]).toEqual({ value: 12.3 });
  });

  it("skips province totals, sub-totals, rows without a code and the Antarctic department, which has no density", () => {
    const { population } = censusSeries([tierraDelFuego, buenosAires]);
    expect(Object.keys(population.periods[0].values)).toEqual(["94008", "06028"]);
  });

  it("says in the period's note that the Antarctic sector is not included", () => {
    expect(censusSeries([cordoba]).density.periods[0].note).toMatch(/Antártida/);
  });

  it("rejects a department listed twice", () => {
    expect(() => censusSeries([cordoba, cordoba])).toThrow(/14014/);
  });
});
