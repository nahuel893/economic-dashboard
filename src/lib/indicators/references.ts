/**
 * Full references of every data source, shown at the bottom of each page.
 * Cards and charts cite only the short name (`SOURCE_NAMES`) and link here.
 */
import { SOURCE_NAMES, type SourceId } from "@/lib/sources/citations";
import { BCRA_VARIABLES, INDEC_SERIES } from "@/lib/sources/clients";
import { BCRA_BALANCES_URL, EMPLOYMENT_URL, IPC_REGION_SERIES, WAGES_URL } from "@/lib/sources/maps";
import censusSnapshot from "@/lib/sources/snapshots/census.json";
import povertySnapshot from "@/lib/sources/snapshots/eph-poverty.json";
import ratesSnapshot from "@/lib/sources/snapshots/eph-rates.json";
import unemploymentSnapshot from "@/lib/sources/snapshots/eph-unemployment.json";
import opexSnapshot from "@/lib/sources/snapshots/opex-exports.json";
import { REGIONS } from "./geography";
import { MACRO_SOURCES } from "./macro";

export type ReferenceItem = { label: string; detail: string; url?: string };

export type Reference = {
  id: SourceId;
  /** Short name, as cited on cards. */
  name: string;
  title: string;
  url: string;
  description: string;
  items: ReferenceItem[];
  update: string;
  note?: string;
};

const DOLLAR_KINDS = "oficial, blue, MEP, contado con liquidación y cripto";
const ARGENTINA_DATOS_API = "https://api.argentinadatos.com";
const DATOS_SERIES_API = "https://apis.datos.gob.ar/series/api/series/?ids=";

const bcraItem = (label: string, id: number): ReferenceItem => ({ label, detail: `Variable ${id}` });

const indecItem = (label: string, seriesId: string, kind: string): ReferenceItem => ({
  label,
  detail: `Serie ${seriesId} (${kind})`,
  url: `${DATOS_SERIES_API}${seriesId}`,
});

/** Templated paths (`{casa}`) are not links: they name one endpoint per dollar. */
const argentinaDatosItem = (label: string, path: string): ReferenceItem => ({
  label,
  detail: `GET ${path}`,
  url: path.includes("{") ? undefined : `${ARGENTINA_DATOS_API}${path}`,
});

const base = {
  dolarapi: {
    id: "dolarapi",
    name: SOURCE_NAMES.dolarapi,
    title: "DolarApi",
    url: "https://dolarapi.com/docs/",
    description: "API pública y gratuita con las cotizaciones del dólar en la Argentina.",
  },
  argentinaDatos: {
    id: "argentinaDatos",
    name: SOURCE_NAMES.argentinaDatos,
    title: "ArgentinaDatos",
    url: "https://argentinadatos.com/docs/",
    description: "API pública y gratuita de datos económicos y financieros de la Argentina.",
  },
  bcra: {
    id: "bcra",
    name: SOURCE_NAMES.bcra,
    title: "Banco Central de la República Argentina, API de Estadísticas v4.0",
    url: "https://www.bcra.gob.ar/en/central-bank-api-catalog/",
    description:
      "Series de «Principales variables». Cada una se pide por su número en api.bcra.gob.ar/estadisticas/v4.0/monetarias/{número}.",
  },
  indec: {
    id: "indec",
    name: SOURCE_NAMES.indec,
    title: "INDEC, Estimador Mensual de Actividad Económica (EMAE), en la API de Series de Tiempo de datos.gob.ar",
    url: "https://datos.gob.ar/series/",
    description:
      "Índice de volumen físico, base 2004 = 100, que aproxima el PBI mes a mes. Las variaciones las calcula este tablero a partir del índice.",
  },
  byma: {
    id: "byma",
    name: SOURCE_NAMES.byma,
    title: "Bolsas y Mercados Argentinos (BYMA), datos abiertos",
    url: "https://open.bymadata.com.ar",
    description: "Precios de índices y valores negociados en BYMA, publicados en forma gratuita.",
  },
  oede: {
    id: "oede",
    name: SOURCE_NAMES.oede,
    title: "Observatorio de Empleo y Dinámica Empresarial (OEDE), Ministerio de Capital Humano, con datos del SIPA",
    url: "https://www.argentina.gob.ar/node/142211",
    description: "Remuneraciones y empleo de los asalariados registrados del sector privado, por provincia.",
  },
  indecEph: {
    id: "indecEph",
    name: SOURCE_NAMES.indecEph,
    title: "INDEC, Encuesta Permanente de Hogares (EPH)",
    url: "https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-46-152",
    description: "Encuesta a hogares de 31 aglomerados urbanos. Sus resultados son estimaciones con error de muestreo.",
  },
  indecOpex: {
    id: "indecOpex",
    name: SOURCE_NAMES.indecOpex,
    title: "INDEC, Origen provincial de las exportaciones (OPEX)",
    url: "https://www.indec.gob.ar",
    description: "Exportaciones de bienes según la provincia donde se produce lo exportado.",
  },
  indecCenso: {
    id: "indecCenso",
    name: SOURCE_NAMES.indecCenso,
    title: "INDEC, Censo Nacional de Población, Hogares y Viviendas 2022. Resultados definitivos",
    url: "https://censo.gob.ar/index.php/datos_definitivos/",
    description: "Población y superficie de cada departamento, partido y comuna del país.",
  },
} as const satisfies Record<SourceId, Omit<Reference, "items" | "update" | "note">>;

const INFLATION_NOTE = "La inflación mensual e interanual son datos del INDEC.";

/** References of "Hoy", in the order the sources first appear on the page. */
export function homeReferences(): Reference[] {
  const macroBcra = MACRO_SOURCES.flatMap(({ label, source }) => (source.kind === "bcra" ? [bcraItem(label, source.id)] : []));
  const macroIndec = MACRO_SOURCES.flatMap(({ label, source }) =>
    source.kind === "indec"
      ? [indecItem(label, source.seriesId, source.change === "yoy" ? "serie original" : "serie desestacionalizada")]
      : [],
  );

  return [
    {
      ...base.dolarapi,
      items: [{ label: `Dólar ${DOLLAR_KINDS}: compra y venta`, detail: "GET /v1/dolares", url: "https://dolarapi.com/v1/dolares" }],
      update: "Se consulta cada 2 minutos.",
    },
    {
      ...base.argentinaDatos,
      items: [
        argentinaDatosItem(
          `Cierres diarios del dólar ${DOLLAR_KINDS}: variación contra el cierre anterior, brecha y gráficos`,
          "/v1/cotizaciones/dolares/{casa}",
        ),
        argentinaDatosItem("Riesgo país: índice EMBI de J.P. Morgan, en puntos básicos", "/v1/finanzas/indices/riesgo-pais"),
      ],
      update: "El riesgo país se consulta cada 2 minutos; los cierres del dólar, cada hora.",
    },
    {
      ...base.bcra,
      items: [
        bcraItem("Dólar mayorista (Comunicación A 3500)", BCRA_VARIABLES.wholesaleDollar),
        bcraItem("Banda cambiaria, piso", BCRA_VARIABLES.bandLower),
        bcraItem("Banda cambiaria, techo", BCRA_VARIABLES.bandUpper),
        ...macroBcra,
      ],
      update: "El mayorista y la banda se consultan cada 2 minutos; el resto, cada hora.",
      note: `${INFLATION_NOTE} La inflación esperada es la mediana del Relevamiento de Expectativas de Mercado (REM). La tasa real esperada la calcula este tablero con el plazo fijo a 30 días y la inflación esperada.`,
    },
    {
      ...base.indec,
      items: macroIndec,
      update: "Se consulta cada hora; el INDEC publica el EMAE una vez por mes.",
    },
    {
      ...base.byma,
      items: [
        {
          label: "S&P Merval (MMSCI): valor, variación, mínimo y máximo del día",
          detail: "POST /vanoms-be-core/rest/api/bymadata/free/index-price",
        },
      ],
      update: "Se consulta cada 2 minutos, con demora.",
      note: "BYMA no ofrece gratis el histórico intradiario, por eso la tarjeta no tiene gráfico. El Merval en dólares se calcula con el contado con liquidación de dolarapi.com.",
    },
  ];
}

/** References of "Histórico", in the order the sources first appear on the page. */
export function historyReferences(): Reference[] {
  return [
    {
      ...base.argentinaDatos,
      items: [
        argentinaDatosItem("Cierres diarios del dólar oficial, blue, MEP y contado con liquidación, y la brecha", "/v1/cotizaciones/dolares/{casa}"),
        argentinaDatosItem("Inflación mensual", "/v1/finanzas/indices/inflacion"),
        argentinaDatosItem("Inflación interanual", "/v1/finanzas/indices/inflacionInteranual"),
        argentinaDatosItem("Riesgo país: índice EMBI de J.P. Morgan, en puntos básicos", "/v1/finanzas/indices/riesgo-pais"),
      ],
      update: "Se consulta cada hora.",
      note: INFLATION_NOTE,
    },
    {
      ...base.indec,
      items: [
        indecItem("Nivel de actividad", INDEC_SERIES.emaeSeasonallyAdjusted, "serie desestacionalizada"),
        indecItem("Actividad, variación interanual", INDEC_SERIES.emae, "serie original"),
      ],
      update: "Se consulta cada hora; el INDEC publica el EMAE una vez por mes.",
    },
    {
      ...base.bcra,
      items: [bcraItem("Reservas internacionales", BCRA_VARIABLES.reserves), bcraItem("BADLAR bancos privados", BCRA_VARIABLES.badlar)],
      update: "Se consulta cada hora.",
    },
  ];
}

/** The last segment of a file URL, as the detail of its reference item. */
const fileName = (url: string) => url.slice(url.lastIndexOf("/") + 1);

/** References of "Mapas", in the order of its indicators: wages and employment, deposits and loans, poverty and the labor rates, inflation, exports, the census. */
export function mapsReferences(): Reference[] {
  return [
    {
      ...base.oede,
      items: [
        {
          label: "Remuneración promedio de los asalariados registrados del sector privado, por provincia (hoja «Total»)",
          detail: fileName(WAGES_URL),
          url: WAGES_URL,
        },
        {
          label: "Puestos de trabajo asalariados registrados del sector privado, por provincia (fila «TOTAL» de cada hoja)",
          detail: fileName(EMPLOYMENT_URL),
          url: EMPLOYMENT_URL,
        },
      ],
      update: "Se consulta una vez por día; el OEDE actualiza los salarios cada mes y el empleo cada trimestre.",
      note: "Salarios en pesos corrientes, sin ajustar por inflación; junio y diciembre incluyen el aguinaldo. La variación interanual del empleo la calcula este tablero contra el mismo trimestre del año anterior. El OEDE separa la Ciudad, los partidos del Gran Buenos Aires y el resto de la provincia.",
    },
    {
      ...base.bcra,
      title: "Banco Central de la República Argentina, Información por provincia (disponibilidades, depósitos y préstamos)",
      url: "https://www.bcra.gob.ar/en/querying-statistical-series-in-txt-format/",
      description:
        "Saldos trimestrales de depósitos y préstamos del sector privado no financiero, clasificados según la ubicación de la sucursal bancaria, en miles de pesos.",
      items: [
        {
          label: "Depósitos y préstamos del sector privado no financiero por provincia, en pesos y en moneda extranjera (series 20318 a 20695)",
          detail: fileName(BCRA_BALANCES_URL),
          url: BCRA_BALANCES_URL,
        },
      ],
      update: "Se consulta una vez por día; el BCRA publica un trimestre nuevo unos meses después de su cierre.",
      note: "Los saldos corresponden a la provincia donde está la sucursal del banco, no a la residencia de quien deposita o toma el préstamo. El archivo suma pesos y moneda extranjera valuada en pesos; este tablero los agrega, pasa los miles de pesos a millones y calcula los préstamos sobre depósitos. El BCRA separa el Gran Buenos Aires del resto de la provincia, igual que el mapa.",
    },
    {
      ...base.indecEph,
      items: [
        ...povertySnapshot.sources.map((url) => ({
          label: "Pobreza e indigencia por aglomerado, en % de personas y de hogares, con su coeficiente de variación (cuadros 4.1 y 4.2)",
          detail: fileName(url),
          url,
        })),
        ...unemploymentSnapshot.sources.map((url) => ({
          label: "Tasa de desocupación por aglomerado (cuadro 1.8)",
          detail: fileName(url),
          url,
        })),
        ...ratesSnapshot.sources.map((url) => ({
          label: "Tasas de actividad y de empleo por aglomerado (cuadros 1.6 y 1.7)",
          detail: fileName(url),
          url,
        })),
      ],
      update: "Copiados en el tablero desde cada informe del INDEC: la pobreza se publica cada semestre y la desocupación y las tasas de actividad y de empleo, cada trimestre.",
      note: "El INDEC no publica estos datos por provincia, sino por aglomerado urbano. Los valores con coeficiente de variación mayor al 16 % se marcan para usar con cuidado.",
    },
    {
      ...base.indec,
      title: "INDEC, Índice de Precios al Consumidor (IPC) por región, en la API de Series de Tiempo de datos.gob.ar",
      description:
        "Nivel general del IPC de cada región, base diciembre 2016 = 100. Las variaciones mensual e interanual las calcula este tablero a partir del índice.",
      items: REGIONS.map((region) => indecItem(region.name, IPC_REGION_SERIES[region.id], "nivel general")),
      update: "Se consulta cada hora; el INDEC publica el IPC una vez por mes.",
      note: "Cada provincia toma el valor de su región: el IPC no se publica por provincia.",
    },
    {
      ...base.indecOpex,
      items: opexSnapshot.sources.map((url) => ({
        label: "Exportaciones de bienes por región económica y provincia, en millones de USD, primer semestre de cada año (hoja «Region-prov 2016-2026 semestre»)",
        detail: fileName(url),
        url,
      })),
      update: "Copiado en el tablero desde el informe del INDEC, que lo publica cada semestre: el primer semestre en septiembre y el año completo en marzo; el mapa usa el primer semestre.",
      note: "Los datos de los últimos años son provisorios. El INDEC informa Buenos Aires como una sola provincia, sin la Ciudad, y el mapa la pinta entera con ese valor. Se excluyen las exportaciones de origen indeterminado y las del extranjero y la plataforma continental. La variación interanual la calcula este tablero.",
    },
    {
      ...base.indecCenso,
      items: censusSnapshot.sources.map((url) => ({
        label: "Total de población y densidad, por superficie, según departamento, partido o comuna (cuadro 2 de cada jurisdicción)",
        detail: fileName(url),
        url,
      })),
      update: "Copiados en el tablero desde los cuadros definitivos del INDEC; el censo se hace cada diez años.",
      note: "La densidad usa la superficie que publica el INDEC. No se muestran las necesidades básicas insatisfechas porque el INDEC no las publica por departamento para este censo. La Antártida Argentina y las islas del Atlántico Sur no se dibujan.",
    },
  ];
}
