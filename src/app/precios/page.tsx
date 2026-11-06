import type { Metadata } from "next";
import { Suspense } from "react";
import { SourceReferences } from "@/components/dashboard/source-references";
import { UnavailableTile } from "@/components/dashboard/stat-tile";
import { PriceExplorer } from "@/features/prices/price-explorer";
import { pricesReferences } from "@/lib/indicators/references";
import { settle } from "@/lib/indicators/settle";
import { SOURCE_NAMES } from "@/lib/sources/citations";
import { getPriceView, getSepaLatest } from "@/lib/sources/prices";

export const metadata: Metadata = {
  title: "Precios | Tablero económico de Argentina",
  description:
    "Buscá un producto y mirá su precio de lista en cada supermercado de Argentina, en un mapa, con los datos diarios de SEPA (Precios Claros).",
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function PricesContent({ searchParams }: Pick<PageProps<"/precios">, "searchParams">) {
  const ean = single((await searchParams).producto)?.trim() || null;
  // Loading the day also warms the product index, so the first search answers quickly.
  const loaded = await settle(SOURCE_NAMES.sepa, () => Promise.all([getSepaLatest(), ean ? getPriceView(ean) : null]));
  if (loaded.status === "error") {
    return <UnavailableTile label="Precios de los supermercados" source={loaded.source} message={loaded.message} />;
  }
  const [latest, view] = loaded.data;
  return <PriceExplorer day={{ date: latest.date, ...latest.counts }} view={view} missing={ean && !view ? ean : null} />;
}

function PricesFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <div className="h-11 w-full max-w-2xl animate-pulse rounded-md bg-card" />
      <div className="h-5 w-96 max-w-full animate-pulse rounded-md bg-card" />
    </div>
  );
}

export default function PricesPage({ searchParams }: PageProps<"/precios">) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight [font-stretch:125%] sm:text-5xl">¿Dónde está más barato?</h1>
        <p className="max-w-prose text-base text-muted-foreground">
          Buscá un producto y mirá cuánto cuesta en cada supermercado del país. Son los precios de lista que las grandes cadenas
          informan cada día a SEPA, el sistema de Precios Claros. Para mover el mapa usá dos dedos, o Ctrl y la rueda del mouse.
        </p>
      </header>

      <Suspense fallback={<PricesFallback />}>
        <PricesContent searchParams={searchParams} />
      </Suspense>

      <SourceReferences references={pricesReferences()}>
        <p>
          Los colores dividen los precios del producto en grupos de tamaño parecido, de más claro (más barato) a más oscuro (más
          caro). Los precios son los que informa cada cadena y pueden no incluir descuentos ni promociones.
        </p>
      </SourceReferences>
    </main>
  );
}
