/**
 * Full references of every data source, shown at the bottom of each page.
 * Cards and charts cite only the short name (`SOURCE_NAMES`) and link here.
 */
import { SOURCE_NAMES, type SourceId } from "@/lib/sources/citations";
import { BCRA_VARIABLES, INDEC_SERIES } from "@/lib/sources/clients";
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
