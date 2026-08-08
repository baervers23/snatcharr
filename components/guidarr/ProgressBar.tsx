"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  total: number;
  activeIndex: number;
  onJump: (index: number) => void;
  labels?: string[];
}

/** Scroll progress bar with clickable jump points — sits below the fixed navbar. */
export default function ProgressBar({ total, activeIndex, onJump, labels }: ProgressBarProps) {
  if (total <= 0) return null;

  const progress = total === 1 ? 100 : (activeIndex / (total - 1)) * 100;

  return (
    <div className="fixed inset-x-0 top-14 z-40 sm:top-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative h-2 overflow-hidden rounded-full bg-muted/40 backdrop-blur-sm">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary/70 transition-all duration-500 ease-out"
            style={{ width: `${Math.max(progress, 4)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-1">
          {Array.from({ length: total }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onJump(index)}
              title={labels?.[index] ?? `Slide ${index + 1}`}
              className="group flex flex-1 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full border-2 transition-all",
                  index <= activeIndex
                    ? "border-primary bg-primary scale-110"
                    : "border-muted-foreground/40 bg-transparent group-hover:border-primary/60",
                )}
              />
              <span className="hidden max-w-full truncate text-[10px] text-muted-foreground sm:block">
                {labels?.[index] ?? index + 1}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
