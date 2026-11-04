import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SourceCitation } from "./source-citation";

export type Delta = { value: number; text: string; label?: string };

type StatTileProps = {
  label: string;
  value: ReactNode;
  secondary?: ReactNode;
  delta?: Delta | null;
  badge?: string;
  source: string;
  asOf?: string;
  size?: "lg" | "md";
  className?: string;
  children?: ReactNode;
};

/** A single headline value with its change, context and an optional chart. */
export function StatTile({
  label,
  value,
  secondary,
  delta,
  badge,
  source,
  asOf,
  size = "lg",
  className,
  children,
}: StatTileProps) {
  return (
    <Card className={cn("min-w-0 gap-3 rounded-lg border-t-[3px] border-t-tone", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {badge ? (
          <Badge variant="outline" className="border-tone/60">
            {badge}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={cn("font-semibold tracking-tight", size === "lg" ? "text-3xl" : "text-2xl")}>{value}</span>
          {delta ? <DeltaChip {...delta} /> : null}
        </div>
        {secondary ? <div className="text-sm text-muted-foreground">{secondary}</div> : null}
        {children}
        <p className="mt-auto flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
          <span>
            <SourceCitation source={source} />
          </span>
          {asOf ? <span>{asOf}</span> : null}
        </p>
      </CardContent>
    </Card>
  );
}

/** Direction is carried by icon and sign, not by color: a rising dollar is not "good". */
function DeltaChip({ value, text, label }: Delta) {
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-foreground/85">
      <Icon className="size-4" aria-hidden />
      {text}
      {label ? <span className="text-muted-foreground">{label}</span> : null}
    </span>
  );
}

export function UnavailableTile({ label, source, message }: { label: string; source: string; message: string }) {
  return (
    <Card className="min-w-0 gap-3 rounded-lg border-t-[3px] border-t-muted">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <span className="text-lg font-medium">No disponible</span>
        <p className="text-sm text-muted-foreground">
          {source} no respondió. Se reintentará en la próxima actualización.
        </p>
        <p className="mt-auto truncate text-xs text-muted-foreground" title={message}>
          {message}
        </p>
      </CardContent>
    </Card>
  );
}
