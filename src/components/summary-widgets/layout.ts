/** How many widgets a host shows (its widgets spec §2.1). */
export type SummaryWidgetCount = 2 | 3;

/**
 * Side by side or stacked (widgets §2.3, §2.4). A host's widgets sit side by
 * side only at md+ when the group's container fits them, about 20rem each;
 * everywhere else they stack. Each widget lays out the same way either way
 * (§5.7), so only the group's classes switch. Every class below overrides a
 * stacked default, so stacked is the base layout and the server HTML needs no
 * script. Static class names, so Tailwind generates them.
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
  },
  3: {
    grid: "md:@min-[60rem]:grid-cols-3 md:@min-[60rem]:divide-x md:@min-[60rem]:divide-y-0",
    shown: "md:@min-[60rem]:grid",
    toggleHidden: "md:@min-[60rem]:hidden",
    noTopRule: "md:@min-[60rem]:border-t-0",
  },
} as const satisfies Record<SummaryWidgetCount, Record<string, string>>;
