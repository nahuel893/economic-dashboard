import { describe, expect, it } from "vitest";
import { decodeEntries, entryRange } from "../../src/lib/sources/sepa-format";
import { readRecords, SepaCollector } from "./sepa-build";

const BOM = "﻿";

const COMERCIO = [
  `${BOM}id_comercio|id_bandera|comercio_cuit|comercio_razon_social|comercio_bandera_nombre|comercio_bandera_url|comercio_ultima_actualizacion|comercio_version_sepa`,
  "9|1|30590360763|CENCOSUD S.A.|Jumbo  |http://www.jumbo.com.ar|2026-11-05T01:00:00-03:00|1.0",
  "9|2|30590360763|CENCOSUD S.A.|Disco|http://www.disco.com.ar|2026-11-05T01:00:00-03:00|1.0",
  "",
  "Ultima actualizacion: 2026-11-05T01:11:41-03:00",
].join("\n");

const BRANCH_HEADER = [
  "id_comercio", "id_bandera", "id_sucursal", "sucursales_nombre", "sucursales_tipo", "sucursales_calle", "sucursales_numero",
  "sucursales_latitud", "sucursales_longitud", "sucursales_observaciones", "sucursales_barrio", "sucursales_codigo_postal",
  "sucursales_localidad", "sucursales_provincia", "sucursales_lunes_horario_atencion", "sucursales_martes_horario_atencion",
  "sucursales_miercoles_horario_atencion", "sucursales_jueves_horario_atencion", "sucursales_viernes_horario_atencion",
  "sucursales_sabado_horario_atencion", "sucursales_domingo_horario_atencion",
].join("|");
const HOURS = "|08 a 22|08 a 22|08 a 22|08 a 22|08 a 22|08 a 22|09 a 14";

const SUCURSALES = [
  `${BOM}${BRANCH_HEADER}`,
  // SEPA splits some records over several lines, with no quoting.
  "9|1|1|Jumbo Palermo|Hipermercado|Av. Bullrich|345|-34.5771",
  "|-58.4220",
  `| |Palermo|1425|CABA|AR-C${HOURS}`,
  `9|2|7|Disco Nueva Córdoba|Supermercado|Obispo Trejo|  1200 |-31.4250|-64.1880| |Centro|5000|  Córdoba |AR-X${HOURS}`,
  // No usable location: its prices are left out.
  `9|2|8|Disco Sin Mapa|Supermercado|Calle|1|0|0| |Centro|5000|Córdoba|AR-X${HOURS}`,
  "",
  "Ultima actualizacion: 2026-11-05T01:11:41-03:00",
].join("\n");

const PRICE_HEADER =
  `${BOM}id_comercio|id_bandera|id_sucursal|id_producto|productos_ean|productos_descripcion|productos_cantidad_presentacion|productos_unidad_medida_presentacion|productos_marca|productos_precio_lista|productos_precio_referencia|productos_cantidad_referencia|productos_unidad_medida_referencia|productos_precio_unitario_promo1|productos_leyenda_promo1|productos_precio_unitario_promo2|productos_leyenda_promo2`;

const price = (branch: string, ean: string, name: string, brand: string, list: string, eanFlag = "1") =>
  `9|${branch}|${ean}|${eanFlag}|${name}|1|un|${brand}|${list}|${list}|1|un||||`;

function collect(lines: string[]) {
  const collector = new SepaCollector();
  collector.addChain(COMERCIO, SUCURSALES);
  collector.startPrices(PRICE_HEADER);
  for (const line of lines) collector.addPriceLine(line);
  return collector.build();
}

describe("readRecords", () => {
  it("strips the BOM, joins records split over lines and skips the footer", () => {
    const { header, rows } = readRecords(SUCURSALES);
    expect(header[0]).toBe("id_comercio");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveLength(21);
    expect(rows[0].slice(3, 9)).toEqual(["Jumbo Palermo", "Hipermercado", "Av. Bullrich", "345", "-34.5771", "-58.4220"]);
  });
});

describe("SepaCollector", () => {
  it("keeps branches with a location, named by their chain, with the province name", () => {
    const { branches } = collect([]);
    expect(branches.chains).toEqual(["Jumbo", "Disco"]);
    expect(branches.branches).toEqual([
      [0, "Jumbo Palermo", "Av. Bullrich 345", "CABA", "Ciudad de Buenos Aires", -58.422, -34.5771],
      [1, "Disco Nueva Córdoba", "Obispo Trejo 1200", "Córdoba", "Córdoba", -64.188, -31.425],
    ]);
  });

  it("indexes each EAN's prices cheapest first, most widely sold products first", () => {
    const { products, prices, stats } = collect([
      price("2|7", "7790895000997", "Gaseosa Cola 2,25 L", "COLA", "3100.50"),
      price("1|1", "7790895000997", "GASEOSA COLA 2.25L", "COLA", "2999.99"),
      price("2|7", "7790895000997", "Gaseosa Cola 2,25 L", "COLA", "3100.50"),
      price("1|1", "07791234000016", "Yerba 1 kg", "YERBAL", "4200"),
      "",
      "Ultima actualizacion: 2026-11-05T01:11:41-03:00",
    ]);

    expect(products).toEqual([
      ["7790895000997", "Gaseosa Cola 2,25 L", "COLA", 0, 2, 299999, 310050],
      ["7791234000016", "Yerba 1 kg", "YERBAL", 2, 1, 420000, 420000],
    ]);
    expect(decodeEntries(prices)).toEqual([
      { branch: 0, cents: 299999 },
      { branch: 1, cents: 310050 },
      { branch: 0, cents: 420000 },
    ]);
    const { start, end } = entryRange(2, 1);
    expect(decodeEntries(prices.subarray(start, end + 1))).toEqual([{ branch: 0, cents: 420000 }]);
    expect(stats).toMatchObject({ prices: 3, duplicates: 1, footer: 2 });
  });

  it("names a product as most chains do, the fullest name on a tie, not by the chain with most branches", () => {
    const collector = new SepaCollector();
    collector.addChain(COMERCIO, SUCURSALES);
    // One chain file with the terse name at two branches...
    collector.startPrices(PRICE_HEADER);
    collector.addPriceLine(price("1|1", "7791337007253", "CHOCOLATADA", "CINDO", "3592"));
    collector.addPriceLine(price("2|7", "7791337007253", "CHOCOLATADA", "CINDO", "3600"));
    // ...and another with the full name at one.
    collector.startPrices(PRICE_HEADER);
    collector.addPriceLine(price("1|1", "7791337007253", "Leche Chocolatada Cindor 1 L", "CINDOR", "3700"));
    expect(collector.build().products[0].slice(1, 3)).toEqual(["Leche Chocolatada Cindor 1 L", "CINDOR"]);
  });

  it("leaves out a street number of zero, which SEPA uses for addresses without one", () => {
    const sucursales = [
      BRANCH_HEADER,
      `9|1|1|Jumbo Lugones|Hiper|Av. Lugones esq. Cont|0|-27.80|-64.26| |x|4200|Santiago del Estero|AR-G${HOURS}`,
    ].join("\n");
    const collector = new SepaCollector();
    collector.addChain(COMERCIO, sucursales);
    expect(collector.build().branches.branches[0][2]).toBe("Av. Lugones esq. Cont");
  });

  it("lists a chain name once when several banners share it", () => {
    const comercio = `${COMERCIO.split("\n")[0]}\n11|1|1|WALMART|SuperChangomas|x|y|1.0\n11|3|1|WALMART|SuperChangomas|x|y|1.0`;
    const sucursales = [
      BRANCH_HEADER,
      `11|1|1|Changomas Lanús|Hiper|Calle|1|-34.70|-58.39| |x|1824|Lanús|AR-B${HOURS}`,
      `11|3|2|Changomas Pilar|Hiper|Calle|2|-34.45|-58.91| |x|1629|Pilar|AR-B${HOURS}`,
    ].join("\n");
    const collector = new SepaCollector();
    collector.addChain(comercio, sucursales);
    const { branches } = collector.build();
    expect(branches.chains).toEqual(["SuperChangomas"]);
    expect(branches.branches.map((b) => b[0])).toEqual([0, 0]);
  });

  it("keeps a branch's lowest price when it lists an EAN twice", () => {
    const { prices } = collect([
      price("1|1", "7790895000997", "Gaseosa", "COLA", "3000"),
      price("1|1", "7790895000997", "Gaseosa", "COLA", "2800"),
    ]);
    expect(decodeEntries(prices)).toEqual([{ branch: 0, cents: 280000 }]);
  });

  it("skips internal codes, unknown or unlocated branches, bad prices and broken lines, and counts them", () => {
    const { products, stats } = collect([
      price("1|1", "123", "Pan por kilo", "", "2500", "0"),
      price("2|8", "7790895000997", "Gaseosa", "COLA", "3000"),
      price("2|99", "7790895000997", "Gaseosa", "COLA", "3000"),
      price("1|1", "7790895000997", "Gaseosa", "COLA", "0"),
      price("1|1", "7790895000997", "Gaseosa", "COLA", "abc"),
      "9|1|1|7790895000997|1|Gaseosa",
    ]);
    expect(products).toEqual([]);
    expect(stats).toMatchObject({ prices: 0, internalCodes: 1, unknownBranches: 2, badPrices: 2, malformed: 1 });
  });
});
