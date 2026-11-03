import type { Metadata } from "next";
import { Suspense } from "react";
import { HistorySections } from "@/features/history/history-sections";
import { RangeFilter } from "@/features/history/range-filter";
import { HISTORY_FLOOR, resolveRange } from "@/lib/indicators/history";
import { getHistorySnapshot } from "@/lib/indicators/history-data";
import { parseMarks } from "@/lib/indicators/marks";

export const metadata: Metadata = {
  title: "Histórico | Tablero económico de Argentina",
  description: "Series históricas del dólar, la inflación, el riesgo país, las reservas y las tasas de Argentina.",
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function HistoryContent({ searchParams }: Pick<PageProps<"/historico">, "searchParams">) {
  const [params, snapshot] = await Promise.all([searchParams, getHistorySnapshot()]);
  const range = resolveRange({ desde: single(params.desde), hasta: single(params.hasta) }, snapshot.latestMonth);
  const marks = parseMarks(single(params.marcas));
  return (
    <>
      <RangeFilter range={range} marks={marks} latest={snapshot.latestMonth} />
      <HistorySections snapshot={snapshot} range={range} marks={marks} />
    </>
  );
}

function HistoryFallback() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-busy>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-80 animate-pulse rounded-lg bg-card ring-1 ring-foreground/10" />
      ))}
    </div>
  );
}

export default function HistoryPage({ searchParams }: PageProps<"/historico">) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight [font-stretch:125%] sm:text-5xl">
          Economía argentina, en el tiempo
        </h1>
        <p className="max-w-prose text-base text-muted-foreground">
          La historia de cada variable desde {HISTORY_FLOOR.slice(0, 4)}. Elegí el período con los botones o con el mes y
          el año de inicio y de fin.
        </p>
      </header>

      <Suspense fallback={<HistoryFallback />}>
        <HistoryContent searchParams={searchParams} />
      </Suspense>

      <footer className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>
          Fuentes: ArgentinaDatos (dólar, inflación del INDEC y riesgo país) y BCRA (reservas y BADLAR). Los valores en
          pesos son nominales, sin ajustar por inflación.
        </p>
        <p>
          Con rangos largos se muestra el cierre de cada semana o de cada mes. Mínimo, máximo y variación se calculan con
          todos los datos del período. Las marcas de presidencias empiezan el día de cada asunción. La escala logarítmica, apagada por defecto, se puede activar en cada gráfico que la admite:
          así un mismo ritmo de suba se ve con la misma pendiente.
        </p>
      </footer>
    </main>
  );
}
