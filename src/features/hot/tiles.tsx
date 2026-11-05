import { RangeMeter } from "@/components/dashboard/range-meter";
import { Sparkline } from "@/components/dashboard/sparkline";
import { StatTile, UnavailableTile } from "@/components/dashboard/stat-tile";
import {
  formatArs,
  formatDate,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  formatUsd,
  formatValue,
} from "@/lib/format";
import { percentGap } from "@/lib/indicators/calc";
import type {
  BandData,
  CountryRiskData,
  CryptoDollarData,
  DollarData,
  GapData,
  Indicator,
  MervalData,
} from "@/lib/indicators/types";

const ars = (v: number) => formatArs(v);

function dailyDelta(current: number, previous: number | null) {
  if (previous === null) return null;
  // Round to the displayed precision so the arrow never contradicts a "0,0 %" label.
  const change = Math.round(percentGap(current, previous) * 10) / 10;
  return { value: change, text: formatSignedPercent(change), label: "vs. cierre anterior" };
}

export function DollarTile({ indicator }: { indicator: Indicator<DollarData> }) {
  if (indicator.status === "error") {
    return <UnavailableTile label="Dólar" source={indicator.source} message={indicator.message} />;
  }
  const { label, quote, previousClose, history } = indicator.data;
  return (
    <StatTile
      label={`Dólar ${label}`}
      value={ars(quote.sell)}
      secondary={`Compra ${ars(quote.buy)}`}
      delta={dailyDelta(quote.sell, previousClose)}
      source={indicator.source}
      asOf={formatDate(quote.updatedAt)}
    >
      <Sparkline points={history} unit="ars" label={`Dólar ${label}, últimos 30 cierres`} />
    </StatTile>
  );
}

export function GapTile({ indicator }: { indicator: Indicator<GapData> }) {
  if (indicator.status === "error") {
    return <UnavailableTile label="Brecha CCL" source={indicator.source} message={indicator.message} />;
  }
  const { valuePct, ccl, official, history } = indicator.data;
  return (
    <StatTile
      label="Brecha CCL vs. oficial"
      value={formatPercent(valuePct)}
      secondary={`CCL ${ars(ccl)} vs. oficial ${ars(official)}`}
      source={indicator.source}
      asOf="Histórico diario"
    >
      <Sparkline points={history} unit="percent" label="Brecha CCL, últimos 30 cierres" />
    </StatTile>
  );
}

export function BandTile({ indicator }: { indicator: Indicator<BandData> }) {
  if (indicator.status === "error") {
    return <UnavailableTile label="Mayorista vs. banda" source={indicator.source} message={indicator.message} />;
  }
  const { wholesale, lower, upper, toCeilingPct, date, history } = indicator.data;
  return (
    <StatTile
      label="Mayorista (A3500) vs. banda cambiaria"
      value={formatValue(wholesale, "ars2")}
      secondary={`${formatPercent(toCeilingPct)} por debajo del techo de la banda`}
      badge="Diario"
      source={indicator.source}
      asOf={formatDate(date)}
    >
      <RangeMeter
        value={wholesale}
        min={lower}
        max={upper}
        minLabel={`Piso ${ars(lower)}`}
        maxLabel={`Techo ${ars(upper)}`}
        ariaLabel="Posición del dólar mayorista dentro de la banda cambiaria"
      />
      <Sparkline points={history} unit="ars2" label="Dólar mayorista, últimos 30 días" />
    </StatTile>
  );
}

export function CryptoDollarTile({ indicator }: { indicator: Indicator<CryptoDollarData> }) {
  if (indicator.status === "error") {
    return <UnavailableTile label="Dólar cripto" source={indicator.source} message={indicator.message} />;
  }
  const { quote, previousClose, history } = indicator.data;
  return (
    <StatTile
      label="Dólar cripto (USDT)"
      value={ars(quote.sell)}
      secondary={`Compra ${ars(quote.buy)}, opera 24/7`}
      delta={dailyDelta(quote.sell, previousClose)}
      source={indicator.source}
      asOf={formatDate(quote.updatedAt)}
    >
      <Sparkline points={history} unit="ars" label="Dólar cripto, últimos 30 cierres" />
    </StatTile>
  );
}

export function CountryRiskTile({ indicator }: { indicator: Indicator<CountryRiskData> }) {
  if (indicator.status === "error") {
    return <UnavailableTile label="Riesgo país" source={indicator.source} message={indicator.message} />;
  }
  const { value, change, date, history } = indicator.data;
  return (
    <StatTile
      label="Riesgo país (EMBI)"
      value={formatValue(value, "bps")}
      delta={
        change === null
          ? null
          : { value: change, text: `${change > 0 ? "+" : ""}${formatNumber(change)} pb`, label: "vs. cierre anterior" }
      }
      badge="Cierre diario"
      source={indicator.source}
      asOf={`Cierre del ${formatDate(date)}`}
    >
      <Sparkline points={history} unit="bps" label="Riesgo país, últimos 30 cierres" />
    </StatTile>
  );
}

export function MervalTile({ indicator }: { indicator: Indicator<MervalData> }) {
  if (indicator.status === "error") {
    return <UnavailableTile label="Merval" source={indicator.source} message={indicator.message} />;
  }
  const { name, value, valueUsd, changePct, high, low, date } = indicator.data;
  const points = (v: number) => formatNumber(v, 2);
  return (
    <StatTile
      label={name}
      value={points(value)}
      secondary={valueUsd === null ? undefined : `${formatUsd(valueUsd, 2)} al CCL`}
      delta={{ value: changePct, text: formatSignedPercent(changePct, 2), label: "hoy" }}
      badge="Con demora"
      source={indicator.source}
      asOf={date ? formatDate(date) : undefined}
    >
      <RangeMeter
        value={value}
        min={low}
        max={high}
        minLabel={`Mín. ${points(low)}`}
        maxLabel={`Máx. ${points(high)}`}
        ariaLabel="Posición del Merval dentro del rango del día"
      />
    </StatTile>
  );
}
