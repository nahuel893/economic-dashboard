import type { Metadata } from "next";
import { Suspense } from "react";
import { SourceReferences } from "@/components/dashboard/source-references";
import { MapExplorer } from "@/features/maps/map-explorer";
import { buildMapView, MAP_KPIS, resolveMapSelection, type MapKpiData, type MapKpiId } from "@/lib/indicators/maps";
import { mapsReferences } from "@/lib/indicators/references";
import { settle } from "@/lib/indicators/settle";
import type { Indicator } from "@/lib/indicators/types";
import { SOURCE_NAMES } from "@/lib/sources/citations";
import { getEphPovertyMap, getLaborRatesMap, getRegionalInflationMap, getUnemploymentMap, getWageMap } from "@/lib/sources/maps";

export const metadata: Metadata = {
  title: "Mapas | Tablero económico de Argentina",
  description:
    "Salarios por provincia, pobreza, desocupación, actividad y empleo por aglomerado e inflación por región de Argentina, en un mapa con el último dato.",
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Each KPI loads on its own: one failing source leaves the others on the map. */
async function loadMapData(): Promise<Record<MapKpiId, Indicator<MapKpiData>>> {
  const [salarios, pobreza, inflacion, desocupacion, actividad] = await Promise.all([
    settle(SOURCE_NAMES.oede, async (): Promise<MapKpiData> => ({ level: await getWageMap() })),
    settle(SOURCE_NAMES.indecEph, async (): Promise<MapKpiData> => ({ ...(await getEphPovertyMap()) })),
    settle(SOURCE_NAMES.indec, async (): Promise<MapKpiData> => ({ ...(await getRegionalInflationMap()) })),
    settle(SOURCE_NAMES.indecEph, async (): Promise<MapKpiData> => ({ unemployment: await getUnemploymentMap() })),
    settle(SOURCE_NAMES.indecEph, async (): Promise<MapKpiData> => ({ ...(await getLaborRatesMap()) })),
  ]);
  return { salarios, pobreza, inflacion, desocupacion, actividad };
}

async function MapsContent({ searchParams }: Pick<PageProps<"/mapas">, "searchParams">) {
  const [params, data] = await Promise.all([searchParams, loadMapData()]);
  const selection = resolveMapSelection(
    { kpi: single(params.kpi), valor: single(params.valor), periodo: single(params.periodo) },
    (kpi, variant) => {
      const indicator = data[kpi.id];
      return indicator.status === "ok" ? (indicator.data[variant.series]?.periods.map((p) => p.period) ?? []) : [];
    },
  );
  const indicator = data[selection.kpi.id];
  return (
    <MapExplorer
      kpis={MAP_KPIS.map((k) => ({ id: k.id, label: k.label, available: data[k.id].status === "ok" }))}
      kpi={selection.kpi.id}
      view={indicator.status === "ok" ? buildMapView(selection, indicator.data) : null}
      failure={
        indicator.status === "error"
          ? { label: selection.kpi.label, source: indicator.source, message: indicator.message }
          : null
      }
    />
  );
}

function MapsFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <div className="h-9 w-80 max-w-full animate-pulse rounded-md bg-card" />
      <div className="h-[60svh] animate-pulse rounded-lg bg-card ring-1 ring-foreground/10 md:h-[min(44rem,75svh)]" />
    </div>
  );
}

export default function MapsPage({ searchParams }: PageProps<"/mapas">) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight [font-stretch:125%] sm:text-5xl">Argentina, en el mapa</h1>
        <p className="max-w-prose text-base text-muted-foreground">
          Dónde se gana más, dónde hay más pobreza y dónde suben más los precios. Cada dato se muestra como lo publica su
          fuente: los salarios por provincia, la inflación por región y la pobreza y la desocupación por aglomerado
          urbano. Arranca en el último dato; elegí otro período arriba del mapa. Para moverlo usá dos dedos, o Ctrl y la
          rueda del mouse.
        </p>
      </header>

      <Suspense fallback={<MapsFallback />}>
        <MapsContent searchParams={searchParams} />
      </Suspense>

      <SourceReferences references={mapsReferences()}>
        <p>
          Los colores dividen los valores visibles en grupos de tamaño parecido, de más claro (menor) a más oscuro (mayor).
          Las Islas Malvinas, las del Atlántico Sur y el sector antártico se dibujan con su contorno, sin datos.
        </p>
      </SourceReferences>
    </main>
  );
}
