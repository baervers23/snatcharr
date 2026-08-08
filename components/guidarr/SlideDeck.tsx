"use client";

import { cn } from "@/lib/utils";
import type { GuidarrSlideWithHtml } from "@/lib/guidarr/types";
import { useCallback, useEffect, useRef, useState } from "react";

interface SlideDeckProps {
  slides: GuidarrSlideWithHtml[];
  onActiveIndexChange: (index: number) => void;
}

/** Stacked slide deck with smooth scroll-snap and redirect-on-active behaviour. */
export default function SlideDeck({ slides, onActiveIndexChange }: SlideDeckProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const redirectedRef = useRef<Set<string>>(new Set());

  const updateActiveFromScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || slides.length === 0) return;

    const slideEls = container.querySelectorAll<HTMLElement>("[data-slide-index]");
    const containerTop = container.getBoundingClientRect().top;
    let closest = 0;
    let minDist = Infinity;

    slideEls.forEach((el) => {
      const index = Number(el.dataset.slideIndex);
      const dist = Math.abs(el.getBoundingClientRect().top - containerTop - 24);
      if (dist < minDist) {
        minDist = dist;
        closest = index;
      }
    });

    setActiveIndex(closest);
    onActiveIndexChange(closest);
  }, [slides.length, onActiveIndexChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handler = () => updateActiveFromScroll();
    container.addEventListener("scroll", handler, { passive: true });
    updateActiveFromScroll();
    return () => container.removeEventListener("scroll", handler);
  }, [updateActiveFromScroll, slides]);

  // Redirect when slide becomes active (once per mount per slide)
  useEffect(() => {
    const slide = slides[activeIndex];
    if (!slide?.redirectUrl) return;

    const key = `${slide.id}-${slide.redirectUrl}`;
    if (redirectedRef.current.has(key)) return;
    redirectedRef.current.add(key);

    const timer = setTimeout(() => {
      window.location.href = slide.redirectUrl!;
    }, 600);
    return () => clearTimeout(timer);
  }, [activeIndex, slides]);

  const scrollToIndex = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-slide-index="${index}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    (window as Window & { guidarrScrollToSlide?: (i: number) => void }).guidarrScrollToSlide =
      scrollToIndex;
    return () => {
      delete (window as Window & { guidarrScrollToSlide?: (i: number) => void })
        .guidarrScrollToSlide;
    };
  }, [scrollToIndex]);

  if (slides.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center shadow-xl backdrop-blur-sm">
        <p className="text-muted-foreground">
          No slides in this group yet. Add content in the Admin area.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="guidarr-slide-deck h-[calc(100vh-7.5rem)] snap-y snap-mandatory overflow-y-auto scroll-smooth pt-4 sm:h-[calc(100vh-8.5rem)]"
    >
      {slides.map((slide, index) => (
        <section
          key={slide.id}
          data-slide-index={index}
          id={`slide-${slide.id}`}
          className={cn(
            "guidarr-slide snap-start scroll-mt-4 px-2 pb-8 sm:px-4",
            index < slides.length - 1 && "min-h-[calc(100vh-8rem)]",
          )}
          style={{
            zIndex: 10 + index,
            transform: `translateY(${index * 4}px)`,
          }}
        >
          <article
            className={cn(
              "mx-auto max-w-3xl rounded-2xl border border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-md transition-transform duration-500 sm:p-10",
              index === activeIndex && "ring-2 ring-primary/30",
            )}
          >
            <header className="mb-6 border-b border-border pb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Slide {index + 1} of {slides.length}
              </p>
              <h2 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">{slide.title}</h2>
            </header>
            <div
              className="guidarr-markdown prose prose-invert max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: slide.html }}
            />
          </article>
        </section>
      ))}
    </div>
  );
}
