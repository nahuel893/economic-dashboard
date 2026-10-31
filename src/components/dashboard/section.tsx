import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "dollars" | "pressure" | "risk" | "money" | "inflation" | "rates" | "indexes";

type SectionProps = {
  id: string;
  title: string;
  description?: string;
  tone: Tone;
  className?: string;
  children: ReactNode;
};

/**
 * A themed block of indicators. Its tone colors the rail, the card rules and
 * every chart inside it, so each topic is recognizable at a glance.
 */
export function Section({ id, title, description, tone, className, children }: SectionProps) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      style={{ "--tone": `var(--tone-${tone})` } as CSSProperties}
      className={cn("flex min-w-0 flex-col gap-4 border-l-4 border-tone pl-4 sm:pl-6", className)}
    >
      <div className="flex flex-col gap-0.5">
        <h2 id={`${id}-heading`} className="text-xl font-bold tracking-tight [font-stretch:115%]">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
