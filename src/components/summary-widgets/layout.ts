import * as React from "react";

/** How many widgets a host shows (its widgets spec §2.1). */
export type SummaryWidgetCount = 2 | 3;

/**
 * Side by side or stacked (widgets §2.3, §2.4). A host's widgets sit side by
 * side only at md+ when the group's container fits them, about 20rem each;
 * everywhere else they stack. Every class below that starts with the
 * side-by-side variant overrides a stacked default, so stacked is the base
 * layout and the server HTML needs no script. Static class names, so
 * Tailwind generates them.
 */
export const SIDE_BY_SIDE_LAYOUT = {
  2: {
    /** The group's grid: one column per widget. */
    grid: "md:@min-[40rem]:grid-cols-2 md:@min-[40rem]:divide-x md:@min-[40rem]:divide-y-0",
    /** Side-by-side widgets always show, whatever was remembered (§2.3). */
    shown: "md:@min-[40rem]:grid",
    /** The collapse control exists only while stacked (§2.3, §2.4). */
    toggleHidden: "md:@min-[40rem]:hidden",
    /** No Summary Row above the widgets, so no rule beneath one. */
    noTopRule: "md:@min-[40rem]:border-t-0",
    /** The label and the headline share a baseline on the top line. */
    section: "md:@min-[40rem]:items-baseline",
    /** Headlines show only side by side (§5.1). */
    headline: "md:@min-[40rem]:block md:@min-[40rem]:order-2",
    /** The bar sits under the label and headline line. */
    bar: "md:@min-[40rem]:order-3",
    /** The breakdown leaves the label line for its own line under the bar (§5.7). */
    breakdown: "md:@min-[40rem]:order-4 md:@min-[40rem]:basis-full",
  },
  3: {
    grid: "md:@min-[60rem]:grid-cols-3 md:@min-[60rem]:divide-x md:@min-[60rem]:divide-y-0",
    shown: "md:@min-[60rem]:grid",
    toggleHidden: "md:@min-[60rem]:hidden",
    noTopRule: "md:@min-[60rem]:border-t-0",
    section: "md:@min-[60rem]:items-baseline",
    headline: "md:@min-[60rem]:block md:@min-[60rem]:order-2",
    bar: "md:@min-[60rem]:order-3",
    breakdown: "md:@min-[60rem]:order-4 md:@min-[60rem]:basis-full",
  },
} as const satisfies Record<SummaryWidgetCount, Record<string, string>>;

export type SideBySideLayout = (typeof SIDE_BY_SIDE_LAYOUT)[SummaryWidgetCount];

/**
 * The side-by-side classes of the enclosing SummaryWidgetGroup. null outside
 * a group: a lone widget has no row to sit in, so it always stacks.
 */
export const SummaryWidgetLayoutContext =
  React.createContext<SideBySideLayout | null>(null);
