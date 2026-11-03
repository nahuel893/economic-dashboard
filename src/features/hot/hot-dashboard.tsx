"use client";

import { createContext, useContext, type ReactNode } from "react";
import useSWR from "swr";
import { Section } from "@/components/dashboard/section";
import { ComparisonPanel } from "@/features/compare/comparison-panel";
import { dollarsSpec, pressureSpec } from "@/features/compare/specs";
import { formatDate } from "@/lib/format";
import type { HotSnapshot } from "@/lib/indicators/types";
import {
  BandTile,
  CountryRiskTile,
  CryptoDollarTile,
  DollarTile,
  GapTile,
  MervalTile,
} from "./tiles";

const REFRESH_MS = 120_000;

async function fetchSnapshot(url: string): Promise<HotSnapshot> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Snapshot request failed: ${response.status}`);
  return response.json();
}

type HotState = { snapshot: HotSnapshot; failed: boolean; refreshing: boolean };

const HotContext = createContext<HotState | null>(null);

function useHot(): HotState {
  const state = useContext(HotContext);
  if (!state) throw new Error("Hot sections must be rendered inside <HotSnapshotProvider>");
  return state;
}

/**
 * Polls the intraday snapshot once and shares it, so live sections can be
 * placed anywhere on the page, interleaved with server-rendered ones.
 */
export function HotSnapshotProvider({ initial, children }: { initial: HotSnapshot; children: ReactNode }) {
  const { data, error, isValidating } = useSWR("/api/hot", fetchSnapshot, {
    fallbackData: initial,
    refreshInterval: REFRESH_MS,
    revalidateOnMount: false,
  });
  return (
    <HotContext value={{ snapshot: data ?? initial, failed: Boolean(error), refreshing: isValidating }}>
      {children}
    </HotContext>
  );
}

export function LiveStatus() {
  const { snapshot, failed, refreshing } = useHot();
  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground sm:items-end" aria-live="polite">
      <span className="flex items-center gap-2 font-medium text-foreground">
        <span
          className={`size-2 rounded-full ${failed ? "bg-destructive" : "bg-tone"} ${refreshing ? "animate-pulse" : ""}`}
          aria-hidden
        />
        {failed ? "Falló la actualización, se muestran los últimos datos" : "En vivo"}
      </span>
      <span>Actualizado el {formatDate(snapshot.generatedAt)}</span>
      <span>Se renueva cada 2 minutos</span>
    </div>
  );
}

export function DollarSection() {
  const { snapshot } = useHot();
  return (
    <Section
      id="dollars"
      title="Dólar"
      description="Cotizaciones de venta."
      tone="dollars"
      aside={<ComparisonPanel title="Comparar cotizaciones" spec={dollarsSpec(snapshot)} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {snapshot.dollars.map((dollar, i) => (
          <DollarTile key={dollar.status === "ok" ? dollar.data.kind : i} indicator={dollar} />
        ))}
      </div>
    </Section>
  );
}

export function PressureSection() {
  const { snapshot } = useHot();
  return (
    <Section
      id="pressure"
      title="Presión cambiaria"
      description="Qué tan tensionado está el tipo de cambio."
      tone="pressure"
      aside={<ComparisonPanel title="Mayorista, cripto y banda cambiaria" spec={pressureSpec(snapshot)} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <GapTile indicator={snapshot.gap} />
        <BandTile indicator={snapshot.band} />
        <CryptoDollarTile indicator={snapshot.cryptoDollar} />
      </div>
    </Section>
  );
}

export function MarketsSection() {
  const { snapshot } = useHot();
  return (
    <Section
      id="markets"
      title="Riesgo y acciones"
      description="Cómo ve el mercado la deuda y las empresas argentinas."
      tone="risk"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <CountryRiskTile indicator={snapshot.countryRisk} />
        <MervalTile indicator={snapshot.merval} />
      </div>
    </Section>
  );
}
