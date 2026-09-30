"use client";

import type React from "react";
import { useState } from "react";
import { ExternalLink, Shuffle } from "lucide-react";
import { pickWeightedTipIndex } from "~/lib/pintips/pick";
import {
  PINTIP_CATEGORY_LABELS,
  type PinTipForCard,
} from "~/lib/pintips/types";

interface PinTipCardProps {
  tips: PinTipForCard[];
  /** The server's weighted random pick for this page load (spec 3.2). */
  initialIndex: number;
  /** The game's PinTips page on Match Play (spec 3.1). */
  href: string;
  /**
   * `hub` matches the scan hub's cards (11px label, 12px/16px padding);
   * `rail` matches the Info tab's rail cards (10px label, 16px padding).
   */
  variant: "hub" | "rail";
}

/**
 * PinTips tip card (spec pintips §3): one tip at a time — full text, its
 * category, the PinTips name, and a text link to the game's tips on Match
 * Play. The shuffle control shows another tip without reloading (spec 3.3),
 * picked with the same vote weighting and never repeating the one showing.
 * The caller renders nothing when a machine has no tips (spec 3.6).
 */
export function PinTipCard({
  tips,
  initialIndex,
  href,
  variant,
}: PinTipCardProps): React.JSX.Element | null {
  const [index, setIndex] = useState(initialIndex);
  const tip = tips[index] ?? tips[0];
  if (!tip) return null;

  const hub = variant === "hub";
  return (
    <section
      className={`rounded-xl border border-outline-variant bg-card ${hub ? "px-4 py-3" : "p-4"}`}
      aria-labelledby={`pintips-heading-${variant}`}
      data-testid="pintips-card"
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2
            id={`pintips-heading-${variant}`}
            className={`${hub ? "text-[11px]" : "text-[10px]"} font-bold tracking-wider text-muted-foreground uppercase`}
          >
            PinTips
          </h2>
          <span
            className="inline-flex h-[18px] items-center rounded-full bg-muted px-[7px] text-[11px] font-semibold whitespace-nowrap text-foreground/85"
            data-testid="pintips-category"
          >
            {PINTIP_CATEGORY_LABELS[tip.category]}
          </span>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="View all tips on Match Play (opens in a new tab)"
        >
          Match Play
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>
      <div className={`flex items-start gap-2 ${hub ? "mt-1.5" : "mt-2"}`}>
        <p
          className="m-0 min-w-0 flex-1 text-sm leading-5"
          aria-live="polite"
          data-testid="pintips-text"
        >
          {tip.text}
        </p>
        {tips.length > 1 ? (
          <button
            type="button"
            onClick={() => {
              setIndex(pickWeightedTipIndex(tips, Math.random, index));
            }}
            aria-label="Show another tip"
            className="-my-2 -mr-3 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Shuffle className="size-[18px]" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
