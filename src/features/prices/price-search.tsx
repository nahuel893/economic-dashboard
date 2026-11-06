"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { formatArs, formatNumber } from "@/lib/format";
import type { ProductHit } from "@/lib/indicators/prices";
import { cn } from "@/lib/utils";

/** Wait this long after the last keystroke before searching. */
const DEBOUNCE_MS = 150;
const MIN_QUERY = 2;

/** Common searches shown before the first one, to show what the box takes. */
const EXAMPLES = ["leche", "yerba", "aceite girasol", "arroz", "fideos", "café"];

type Status = "idle" | "loading" | "done" | "error";

type PriceSearchProps = {
  /** What the box shows when the page opens with a product. */
  initialQuery?: string;
  onPick: (hit: ProductHit) => void;
  showExamples?: boolean;
};

/** A search box that suggests SEPA products as you type; picking one shows its prices. */
export function PriceSearch({ initialQuery = "", onPick, showExamples = false }: PriceSearchProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // The query the user typed, not one filled in by a pick: only typing searches.
  const [typed, setTyped] = useState<string | null>(null);

  useEffect(() => {
    if (typed === null || typed.trim().length < MIN_QUERY) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch(`/api/precios?q=${encodeURIComponent(typed.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const result = (await response.json()) as { hits: ProductHit[] };
        setHits(result.hits);
        setActive(result.hits.length ? 0 : -1);
        setStatus("done");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typed]);

  const type = (value: string) => {
    setQuery(value);
    setTyped(value);
    setOpen(value.trim().length >= MIN_QUERY);
    if (value.trim().length < MIN_QUERY) {
      setHits([]);
      setStatus("idle");
    }
  };

  const pick = (hit: ProductHit) => {
    setQuery(hit.name);
    setTyped(null);
    setOpen(false);
    onPick(hit);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!hits.length) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + hits.length) % hits.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open && hits[active]) pick(hits[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && query.trim().length >= MIN_QUERY;
  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-2xl">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Buscar un producto
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Buscá un producto o su código de barras"
          value={query}
          onChange={(e) => type(e.target.value)}
          onKeyDown={onKeyDown}
          // Focus only reopens the list; an example button opens it before focusing.
          onFocus={() => {
            if (query.trim().length >= MIN_QUERY) setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          className="h-11 w-full rounded-md border border-input bg-card pr-3 pl-9 text-base focus-visible:outline-2 focus-visible:outline-ring"
        />

        {showList ? (
          <div className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-md bg-card shadow-lg ring-1 ring-foreground/10">
            {status === "error" ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No pudimos buscar. Probá de nuevo en un momento.</p>
            ) : status === "done" && hits.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Ningún producto coincide con «{query.trim()}».</p>
            ) : null}
            <ul id={listId} role="listbox" aria-label="Productos" className="max-h-[min(24rem,50svh)] overflow-y-auto">
              {hits.map((hit, i) => (
                <li
                  key={hit.ean}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  // Pick on mouse down, before the input's blur closes the list.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(hit);
                  }}
                  onMouseMove={() => setActive(i)}
                  className={cn("flex cursor-pointer items-baseline justify-between gap-4 px-3 py-2 text-sm", i === active && "bg-muted")}
                >
                  <span className="min-w-0">
                    <span className="line-clamp-2 font-medium">{hit.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {hit.brand ? `${hit.brand}, ` : ""}en {formatNumber(hit.stores)} {hit.stores === 1 ? "sucursal" : "sucursales"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    desde <span className="text-sm font-semibold text-foreground">{formatArs(hit.min)}</span>
                  </span>
                </li>
              ))}
            </ul>
            {status === "loading" && hits.length === 0 ? <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p> : null}
          </div>
        ) : null}
      </div>

      {showExamples ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Probá con
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                type(example);
                inputRef.current?.focus();
              }}
              className="rounded-full bg-card px-3 py-1 text-foreground ring-1 ring-foreground/10 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              {example}
            </button>
          ))}
        </p>
      ) : null}
    </div>
  );
}
