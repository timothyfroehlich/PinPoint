import { createContext } from "react";

/** How many widgets a host shows (its widgets spec §2.1). */
export type SummaryWidgetCount = 2 | 3;

/**
 * Side by side or stacked (widgets §2.3, §2.4). A host's widgets sit side by
 * side only at md+ when the group's container fits them, about 20rem each;
 * everywhere else they stack, in the phone presentation at every width: no
 * card, no rules between widgets, no breakdown swatches (§5.7), and the
 * Summary Row toggle in the page title row when the host puts one there
 * (list-views §8.4). Every class below overrides a stacked default, so
 * stacked is the base layout and the server HTML needs no script. Static
 * class names, so Tailwind generates them.
 */
export const SIDE_BY_SIDE_LAYOUT = {
  2: {
    /** The group's grid: one column per widget, ruled between. */
    grid: "md:@min-[40rem]:grid-cols-2 md:@min-[40rem]:divide-x",
    /** Side-by-side widgets always show, whatever was remembered (§2.3). */
    shown: "md:@min-[40rem]:grid",
    /**
     * The collapse control exists only while stacked (§2.3, §2.4). A toggle
     * outside the group queries a container exactly as wide as the group's.
     */
    toggleHidden: "md:@min-[40rem]:hidden",
    /** Side-by-side widgets sit in one card. */
    card: "md:@min-[40rem]:rounded-lg md:@min-[40rem]:border md:@min-[40rem]:bg-card",
    /** The card replaces the stacked section's bottom space. */
    content: "md:@min-[40rem]:pb-0",
    /** Each widget's padding inside the card. */
    widget:
      "md:@min-[40rem]:gap-y-1.5 md:@min-[40rem]:px-4 md:@min-[40rem]:py-3",
    /** Breakdown swatches show only side by side (§5.7). */
    swatch: "md:@min-[40rem]:inline-block",
  },
  3: {
    grid: "md:@min-[60rem]:grid-cols-3 md:@min-[60rem]:divide-x",
    shown: "md:@min-[60rem]:grid",
    toggleHidden: "md:@min-[60rem]:hidden",
    card: "md:@min-[60rem]:rounded-lg md:@min-[60rem]:border md:@min-[60rem]:bg-card",
    content: "md:@min-[60rem]:pb-0",
    widget:
      "md:@min-[60rem]:gap-y-1.5 md:@min-[60rem]:px-4 md:@min-[60rem]:py-3",
    swatch: "md:@min-[60rem]:inline-block",
  },
} as const satisfies Record<SummaryWidgetCount, Record<string, string>>;

/**
 * The widget count of the group a Summary Widget sits in, so the widget
 * switches with the group's layout; null outside a group, where it stays
 * stacked.
 */
export const SummaryWidgetCountContext =
  createContext<SummaryWidgetCount | null>(null);
