import type { Metadata } from "next";
import { Suspense } from "react";
import { SourceReferences } from "@/components/dashboard/source-references";
import { PanelBoard } from "@/features/panel/panel-board";
import { RangeFilter } from "@/features/history/range-filter";
import { resolveRange } from "@/lib/indicators/history";
import { getHistorySnapshot } from "@/lib/indicators/history-data";
import { buildPanel } from "@/lib/indicators/panel";
import { historyReferences } from "@/lib/indicators/references";

export const metadata: Metadata = {
  title: "Panel | Tablero económico de Argentina",
  description: "Los indicadores clave de la economía argentina en una sola pantalla, con un período común para todos los gráficos.",
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function PanelContent({ searchParams }: Pick<PageProps<"/panel">, "searchParams">) {
  const [params, snapshot] = await Promise.all([searchParams, getHistorySnapshot()]);
  const range = resolveRange({ desde: single(params.desde), hasta: single(params.hasta) }, snapshot.latestMonth);
  return (
    <>
      <RangeFilter range={range} latest={snapshot.latestMonth} path="/panel" />
      <PanelBoard panel={buildPanel(snapshot, range)} />
    </>
  );
}

function PanelFallback() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-busy>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-lg bg-card ring-1 ring-foreground/10" />
      ))}
    </div>
  );
}

export default function PanelPage({ searchParams }: PageProps<"/panel">) {
  return (
    <main className="mx-auto flex w-full max-w-[120rem] flex-col gap-4 px-4 pb-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight [font-stretch:125%]">Panel</h1>
        <p className="text-sm text-muted-foreground">
          El período vale para todo el tablero. Tocá un indicador para verlo en grande; el mouse marca el mismo mes en
          todos los gráficos. Arrastrá sobre un gráfico, o mové la barra del gráfico grande, para acercar todos a esos meses.
        </p>
      </header>

      <Suspense fallback={<PanelFallback />}>
        <PanelContent searchParams={searchParams} />
      </Suspense>

      <SourceReferences references={historyReferences()}>
        <p>
          Los gráficos muestran el cierre de cada mes; el último valor y la variación de cada indicador se calculan con todos
          los datos del período. Los valores en pesos son nominales, sin ajustar por inflación.
        </p>
      </SourceReferences>
    </main>
  );
}
