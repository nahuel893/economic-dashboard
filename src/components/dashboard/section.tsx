import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "dollars" | "pressure" | "risk" | "money" | "inflation" | "rates" | "indexes";

type SectionProps = {
  id: string;
  title: string;
  description?: string;
  tone: Tone;
  className?: string;
  /** Optional side panel; cards move to the left and the panel sticks on the right. */
  aside?: ReactNode;
  children: ReactNode;
};

/**
 * A themed block of indicators. Its tone colors the rail, the card rules and
 * every chart inside it, so each topic is recognizable at a glance.
 */
export function Section({ id, title, description, tone, className, aside, children }: SectionProps) {
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
      {aside ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)]">
          <div className="min-w-0">{children}</div>
          <aside className="min-w-0 lg:sticky lg:top-6">{aside}</aside>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
