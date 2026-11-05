"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Hoy" },
  { href: "/panel", label: "Panel" },
  { href: "/historico", label: "Histórico" },
  { href: "/mapas", label: "Mapas" },
] as const;

/** Tabs between the live dashboard, the one-screen panel, the historical series and the maps. */
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones del tablero"
      // The panel is a full-width dashboard; the other tabs keep a readable column.
      className={cn("mx-auto w-full px-4 pt-6 pb-8 sm:px-6 lg:px-8", pathname === "/panel" ? "max-w-[120rem]" : "max-w-7xl")}
    >
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
