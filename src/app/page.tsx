import {
  DollarSection,
  HotSnapshotProvider,
  LiveStatus,
  MarketsSection,
  PressureSection,
} from "@/features/hot/hot-dashboard";
import { SourceReferences } from "@/components/dashboard/source-references";
import { MacroGroupSection } from "@/features/macro/macro-sections";
import { getHotSnapshot } from "@/lib/indicators/hot";
import { getMacroSnapshot } from "@/lib/indicators/macro";
import { homeReferences } from "@/lib/indicators/references";

export default async function Home() {
  const [hot, macro] = await Promise.all([getHotSnapshot(), getMacroSnapshot()]);

  return (
    <HotSnapshotProvider initial={hot}>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 pb-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight [font-stretch:125%] sm:text-5xl">
              Economía argentina, hoy
            </h1>
            <p className="max-w-prose text-base text-muted-foreground">
              Dólar, inflación, reservas, tasas y mercados en un solo lugar, con datos oficiales y de mercado.
            </p>
          </div>
          <LiveStatus />
        </header>

        {/* Order: the dollar first, then the real economy, then financial markets. */}
        <DollarSection />
        <PressureSection />
        <MacroGroupSection snapshot={macro} id="inflation" />
        <MacroGroupSection snapshot={macro} id="activity" />
        <MacroGroupSection snapshot={macro} id="money" />
        <MacroGroupSection snapshot={macro} id="rates" />
        <MarketsSection />
        <MacroGroupSection snapshot={macro} id="indexes" />

        <SourceReferences references={homeReferences()}>
          <p>Los datos de mercado pueden tener demora. No constituye asesoramiento financiero.</p>
        </SourceReferences>
      </main>
    </HotSnapshotProvider>
  );
}
