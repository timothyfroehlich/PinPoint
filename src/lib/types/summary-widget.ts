/**
 * Which records a Summary Widget summarizes (widgets spec §1, §3): the host's
 * whole scope, or every record matching its current search and filters.
 */
export const WIDGET_POPULATIONS = ["all", "filtered"] as const;

export type WidgetPopulation = (typeof WIDGET_POPULATIONS)[number];
