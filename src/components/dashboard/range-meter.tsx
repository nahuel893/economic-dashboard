type RangeMeterProps = {
  value: number;
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
  ariaLabel: string;
};

/** Where a value sits between a floor and a ceiling (exchange-rate band, intraday range). */
export function RangeMeter({ value, min, max, minLabel, maxLabel, ariaLabel }: RangeMeterProps) {
  const span = max - min;
  const position = span > 0 ? ((value - min) / span) * 100 : 50;
  const clamped = Math.min(100, Math.max(0, position));

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="relative h-2 rounded-full bg-muted"
        role="meter"
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-tone/35" style={{ width: `${clamped}%` }} />
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-tone"
          style={{ left: `${clamped}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
