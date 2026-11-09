"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { activeSlideIndex, stepSlideIndex } from "./carousel-position";
import { toneVar, type Tone } from "./tones";

export type CarouselSlide = { id: string; label: string; tone: Tone; content: ReactNode };

/**
 * Shows one section at a time in a horizontal, snap-scrolling track. A tab bar
 * on top jumps between sections and follows swipes, so the page stops being a
 * long vertical scroll.
 */
export function SectionCarousel({ slides, label }: { slides: CarouselSlide[]; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setActive(activeSlideIndex(track.scrollLeft, track.clientWidth, slides.length)),
      );
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [slides.length]);

  // The track follows the active section's height, so short sections leave no gap below.
  useEffect(() => {
    const panel = panelRefs.current[active];
    if (!panel) return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize[0]?.blockSize));
    observer.observe(panel);
    return () => observer.disconnect();
  }, [active]);

  // Keep the active tab visible when the bar itself overflows on small screens.
  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    setActive(index);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: index * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = stepSlideIndex(active, event.key, slides.length);
    if (next === null) return;
    event.preventDefault();
    goTo(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-background/90 px-4 py-3 backdrop-blur [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${slide.id}-tab`}
            aria-selected={i === active}
            aria-controls={`${slide.id}-panel`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => goTo(i)}
            style={{ "--tone": toneVar(slide.tone) } as CSSProperties}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              "focus-visible:ring-2 focus-visible:ring-tone focus-visible:outline-none",
              i === active
                ? "border-tone bg-tone text-background"
                : "border-border text-muted-foreground hover:border-tone hover:text-foreground",
            )}
          >
            {slide.label}
          </button>
        ))}
      </div>

      <div
        ref={trackRef}
        style={{ height }}
        className="flex snap-x snap-mandatory items-start overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            role="tabpanel"
            id={`${slide.id}-panel`}
            aria-labelledby={`${slide.id}-tab`}
            aria-hidden={i !== active}
            inert={i !== active}
            className="w-full shrink-0 snap-start snap-always"
          >
            {slide.content}
          </div>
        ))}
      </div>
    </div>
  );
}
