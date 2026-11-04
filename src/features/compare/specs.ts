import type { Unit } from "@/lib/format";
import type { MacroGroup, MacroItem } from "@/lib/indicators/macro";
import { annualizeMonthly, type ChangeKind } from "@/lib/indicators/stats";
import type { HotSnapshot, Point } from "@/lib/indicators/types";

export type CompareVariable = {
  key: string;
  label: string;
  points: Point[];
  /** False for series whose path is fixed or derived, where r would be meaningless. */
  correlate: boolean;
};

/**
 * How a section compares its variables. `mode` is chosen per section:
 * - "level": raw values on one axis, only when every variable shares the unit
 *   and the same order of magnitude, so no line gets flattened.
 * - "index100": each series rebased to 100 at the start of the window, when
 *   units or magnitudes differ.
 * - "change": each rate minus its starting value, in percentage points, when
 *   rates share the unit but one level would flatten the others.
 */
export type CompareSpec = {
  mode: "level" | "index100" | "change";
  unit: Unit;
  frequency: "daily" | "monthly";
  change: ChangeKind;
  variables: CompareVariable[];
  /** Pairs related by definition: shown as such instead of with an r. */
  mechanical: { a: string; b: string; reason: string }[];
  notes: string[];
};

const usable = (points: Point[] | undefined): points is Point[] => Boolean(points && points.length > 1);

/** Dollar quotes: same unit and magnitude (~$1.500-1.700), so raw pesos on one axis. */
export function dollarsSpec(snapshot: HotSnapshot): CompareSpec {
  return {
    mode: "level",
    unit: "ars",
    frequency: "daily",
    change: "log",
    variables: snapshot.dollars.flatMap((d) =>
      d.status === "ok" && usable(d.data.longHistory)
        ? [{ key: d.data.kind, label: d.data.label, points: d.data.longHistory, correlate: true }]
        : [],
    ),
    mechanical: [],
    notes: ["El MEP y el CCL se arbitran entre sí, así que una correlación alta entre ellos es esperable."],
  };
}

/**
 * FX pressure: wholesale, crypto and the band limits are all pesos per dollar
 * within the same order of magnitude (~$700-2.000), so they share a raw axis.
 * The gap is excluded: it is a percentage derived from CCL and official.
 */
export function pressureSpec(snapshot: HotSnapshot): CompareSpec {
  const variables: CompareVariable[] = [];
  if (snapshot.band.status === "ok") {
    const { longHistory, upperHistory, lowerHistory } = snapshot.band.data;
    if (usable(longHistory)) variables.push({ key: "wholesale", label: "Mayorista", points: longHistory, correlate: true });
    if (usable(upperHistory)) variables.push({ key: "upper", label: "Techo de banda", points: upperHistory, correlate: false });
    if (usable(lowerHistory)) variables.push({ key: "lower", label: "Piso de banda", points: lowerHistory, correlate: false });
  }
  if (snapshot.cryptoDollar.status === "ok" && usable(snapshot.cryptoDollar.data.longHistory)) {
    variables.push({ key: "crypto", label: "Cripto", points: snapshot.cryptoDollar.data.longHistory, correlate: true });
  }
  return {
    mode: "level",
    unit: "ars",
    frequency: "daily",
    change: "log",
    variables,
    mechanical: [],
    notes: [
      "Las bandas siguen una trayectoria preanunciada, por eso no se correlacionan.",
      "La brecha no se grafica: está en % y se calcula a partir del CCL y el oficial.",
    ],
  };
}

const okItem = (group: MacroGroup, key: string) => {
  const item = group.items.find((i) => i.key === key);
  return item?.indicator.status === "ok" && usable(item.indicator.data.longHistory) ? item : undefined;
};

const asVariable = (item: MacroItem, correlate = true, label = item.label): CompareVariable => ({
  key: item.key,
  label,
  points: item.indicator.status === "ok" ? item.indicator.data.longHistory : [],
  correlate,
});

/** Builds the comparison for a macro section, or null when there is nothing meaningful to compare. */
export function macroSpec(group: MacroGroup): CompareSpec | null {
  const item = (key: string) => okItem(group, key);
  const pick = (keys: string[]) => keys.flatMap((k) => (item(k) ? [asVariable(item(k)!)] : []));

  switch (group.id) {
    case "inflation": {
      // Monthly (~2 %) and yearly (~33 %) differ by an order of magnitude: the
      // monthly rate is annualized so all three share a scale in %.
      const monthly = item("monthlyInflation");
      const variables: CompareVariable[] = [];
      if (monthly && monthly.indicator.status === "ok") {
        variables.push({
          key: "annualizedMonthly",
          label: "Mensual anualizada",
          points: monthly.indicator.data.longHistory.map((p) => ({ date: p.date, value: annualizeMonthly(p.value) })),
          correlate: true,
        });
      }
      variables.push(...pick(["yearlyInflation", "expectedInflation"]));
      return {
        mode: "level",
        unit: "percent",
        frequency: "monthly",
        change: "diff",
        variables,
        mechanical: [
          { a: "annualizedMonthly", b: "yearlyInflation", reason: "La interanual acumula las últimas 12 inflaciones mensuales." },
        ],
        notes: [
          "La inflación mensual se anualiza para compararla en la misma escala que las demás.",
          "Ventana de 15 meses: antes, la interanual venía de niveles cercanos al 200 % (desinflación de 2024-25), un cambio de régimen que distorsiona la comparación.",
          "Con pocos meses la correlación es imprecisa: mirá el intervalo de confianza.",
        ],
      };
    }
    case "money":
      // Dollars (reserves) and pesos (trillions) cannot share an axis: base 100.
      return {
        mode: "index100",
        unit: "index2",
        frequency: "daily",
        change: "log",
        variables: pick(["reserves", "monetaryBase", "deposits", "timeDeposits", "privateLoans"]),
        mechanical: [
          { a: "deposits", b: "timeDeposits", reason: "Los depósitos a plazo son parte de los depósitos totales." },
        ],
        notes: [
          "Base 100 al inicio del período: muestra cuánto creció cada variable, no su tamaño.",
          "El M2 no se incluye porque ya es una variación interanual en %.",
        ],
      };
    case "rates":
      // Personal loans (~60 %) would flatten deposit rates (~22-25 %) on a raw
      // axis, and base 100 misreads rates; change in points keeps one scale.
      return {
        mode: "change",
        unit: "percent",
        frequency: "daily",
        change: "diff",
        variables: pick(["termDeposit", "tamar", "badlar", "personalLoans", "overdraft"]),
        mechanical: [],
        notes: [
          "Plazo fijo, BADLAR y TAMAR son tasas de depósitos y se mueven juntas: una correlación alta es esperable.",
          "La tasa real no se incluye porque no tiene histórico propio.",
        ],
      };
    case "activity":
      // Both cards come from the same EMAE, one as a yearly and one as a monthly
      // change: comparing them would only show that relationship.
      return null;
    case "indexes":
      // UVA (~$2.000), CER (~860) and ICL (~37) span two orders of magnitude: base 100.
      return {
        mode: "index100",
        unit: "index2",
        frequency: "daily",
        change: "log",
        variables: ["uva", "cer", "icl"].flatMap((k) => (item(k) ? [asVariable(item(k)!, false)] : [])),
        mechanical: [],
        notes: [
          "No se calcula correlación: la UVA se ajusta por CER y el ICL se calcula con inflación y salarios, así que están vinculados por definición.",
        ],
      };
  }
}
