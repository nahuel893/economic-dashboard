import { Fragment } from "react";
import { CITATION_SEPARATOR, citationParts, sourceAnchor } from "@/lib/sources/citations";

/** Short source name(s) of a value, each linked to its full reference at the bottom of the page. */
export function SourceCitation({ source }: { source: string }) {
  return citationParts(source).map(({ name, id }, index) => (
    <Fragment key={name}>
      {index > 0 ? CITATION_SEPARATOR : null}
      {id ? (
        <a
          href={`#${sourceAnchor(id)}`}
          className="underline decoration-dotted underline-offset-2 hover:text-foreground focus-visible:text-foreground"
        >
          {name}
        </a>
      ) : (
        name
      )}
    </Fragment>
  ));
}
