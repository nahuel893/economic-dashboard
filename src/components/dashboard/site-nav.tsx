"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Hoy" },
  { href: "/historico", label: "Histórico" },
] as const;

/** Tabs between the live dashboard and the historical series. */
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones del tablero" className="mx-auto w-full max-w-7xl px-4 pt-6 pb-8 sm:px-6 lg:px-8">
      <ul className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const current = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  current
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
