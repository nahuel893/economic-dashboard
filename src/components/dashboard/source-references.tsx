import type { ReactNode } from "react";
import type { Reference } from "@/lib/indicators/references";
import { sourceAnchor } from "@/lib/sources/citations";

const linkClass = "underline decoration-dotted underline-offset-2 hover:text-foreground";

/** The full reference of every source cited on the page, plus page-wide notes. */
export function SourceReferences({ references, children }: { references: Reference[]; children?: ReactNode }) {
  return (
    <footer aria-labelledby="fuentes-heading" className="flex flex-col gap-6 border-t border-border pt-8 text-sm text-muted-foreground">
      <h2 id="fuentes-heading" className="text-lg font-bold tracking-tight text-foreground [font-stretch:115%]">
        Fuentes
      </h2>
      <ol className="gap-x-10 lg:columns-2">
        {references.map((ref) => (
          <li key={ref.id} id={sourceAnchor(ref.id)} className="mb-8 flex min-w-0 scroll-mt-6 break-inside-avoid flex-col gap-2 last:mb-0">
            <h3 className="font-semibold text-foreground">
              {ref.name}
              {ref.name !== ref.title ? <span className="font-normal text-muted-foreground">: {ref.title}</span> : null}
            </h3>
            <p>
              {ref.description}{" "}
              <a href={ref.url} className={linkClass} target="_blank" rel="noreferrer">
                Documentación
              </a>
            </p>
            <ul className="flex flex-col gap-1.5">
              {ref.items.map((item) => (
                <li key={item.detail} className="flex flex-wrap gap-x-2">
                  <span className="text-foreground/85">{item.label}</span>
                  {item.url ? (
                    <a href={item.url} className={linkClass} target="_blank" rel="noreferrer">
                      <code className="text-xs break-all">{item.detail}</code>
                    </a>
                  ) : (
                    <code className="text-xs break-all">{item.detail}</code>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs">
              {ref.update}
              {ref.note ? ` ${ref.note}` : null}
            </p>
          </li>
        ))}
      </ol>
      {children ? <div className="flex flex-col gap-1 text-xs">{children}</div> : null}
    </footer>
  );
}
