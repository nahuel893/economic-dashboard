const LOCALE = "es-AR";

export function formatArs(value: number, decimals = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatUsd(value: number, decimals = 0): string {
  return `US$ ${formatNumber(value, decimals)}`;
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatSignedPercent(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatNumber(Math.abs(value), decimals)} %`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)} %`;
}

export function formatUsdMillions(millions: number): string {
  return `US$ ${formatNumber(millions)} M`;
}

/** Large peso aggregates (reported in millions) in Spanish long scale: billón = 10^12. */
export function formatArsMillions(millions: number): string {
  return millions >= 1_000_000
    ? `$ ${formatNumber(millions / 1_000_000, 1)} billones`
    : `$ ${formatNumber(millions / 1_000, 1)} mil millones`;
}

/** Serializable unit names, so server components can tell client charts how to format. */
export type Unit = "ars" | "count" | "ars2" | "percent" | "bps" | "usdMillions" | "arsMillions" | "index" | "index2" | "perKm2";

export function formatValue(value: number, unit: Unit): string {
  switch (unit) {
    case "ars":
      return formatArs(value);
    case "ars2":
      return formatArs(value, 2);
    case "percent":
      return formatPercent(value);
    case "count":
      return formatNumber(value);
    case "bps":
      return `${formatNumber(value)} pb`;
    case "usdMillions":
      return formatUsdMillions(value);
    case "arsMillions":
      return formatArsMillions(value);
    case "index":
      return formatNumber(value, 4);
    case "index2":
      return formatNumber(value, 2);
    case "perKm2":
      return `${formatNumber(value, 1)} hab./km²`;
  }
}

/** Month and year of a calendar date (YYYY-MM-DD), e.g. "septiembre de 2026". */
export function formatMonth(isoDate: string): string {
  return new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(isoDate),
  );
}

/** Abbreviated month of a calendar date, e.g. "oct", for chart axes. */
export function formatMonthShort(isoDate: string): string {
  return new Intl.DateTimeFormat(LOCALE, { month: "short", timeZone: "UTC" })
    .format(new Date(isoDate))
    .replace(/\.$/, "");
}

export function formatDate(isoDate: string): string {
  // Plain dates (YYYY-MM-DD) are calendar days: render them in UTC so they never shift a day.
  const isPlainDate = /^\d{4}-\d{2}-\d{2}$/.test(isoDate);
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: isPlainDate ? "numeric" : undefined,
    hour: isPlainDate ? undefined : "2-digit",
    minute: isPlainDate ? undefined : "2-digit",
    timeZone: isPlainDate ? "UTC" : "America/Argentina/Buenos_Aires",
  }).format(new Date(isoDate));
}

/** "$ 98,2 B" (billones, 10^12), "$ 12,3 mil M" (mil millones, 10^9) or "$ 950 M" for an amount in millions of pesos. */
function formatCompactArsMillions(millions: number): string {
  const size = Math.abs(millions);
  const [scaled, suffix] = size >= 1e6 ? [millions / 1e6, " B"] : size >= 1e3 ? [millions / 1e3, " mil M"] : [millions, " M"];
  return `$ ${new Intl.NumberFormat(LOCALE, { maximumSignificantDigits: 3 }).format(scaled)}${suffix}`;
}

/** Short value for a map label: "$ 2,76 M", "40,6 mil" or "33,4 %". The exact value stays in the tooltip and the table. */
export function formatCompact(value: number, unit: Unit): string {
  if (unit === "percent") return formatPercent(value, 1);
  if (unit === "arsMillions") return formatCompactArsMillions(value);
  const size = Math.abs(value);
  // Already in millions: "mil" would read as thousands of millions, so keep them whole up to US$ 999.999 M.
  if (unit === "usdMillions") return `US$ ${size >= 100 ? formatNumber(value) : new Intl.NumberFormat(LOCALE, { maximumSignificantDigits: 3 }).format(value)} M`;
  const [scaled, suffix] = size >= 1e6 ? [value / 1e6, " M"] : size >= 1e3 ? [value / 1e3, " mil"] : [value, ""];
  const digits = new Intl.NumberFormat(LOCALE, { maximumSignificantDigits: 3 }).format(scaled);
  return `${unit === "ars" ? "$ " : ""}${digits}${suffix}`;
}

/** Shorter values for chart axes: no cents unless the values are small, and no currency on millions (the description says it). */
export function formatAxisValue(value: number, unit: Unit): string {
  if (unit === "usdMillions" || unit === "index" || unit === "index2") return formatNumber(value);
  const small = value !== 0 && Math.abs(value) < 10;
  if (unit === "ars2") return formatArs(value, small ? 1 : 0);
  if (unit === "percent") return `${formatNumber(value, small ? 1 : 0)} %`;
  return formatValue(value, unit);
}

/** A change over a period: relative in percent, or absolute in percentage points for rates. */
export function formatChange(value: number, kind: "percent" | "points"): string {
  return kind === "percent"
    ? formatSignedPercent(value, 1)
    : `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatNumber(Math.abs(value), 1)} pp`;
}
