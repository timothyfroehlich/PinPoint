export type BadgeSize = "xs" | "sm" | "md";

/**
 * Canonical badge padding/type-size per visual density tier.
 * - xs: info grids, very dense contexts
 * - sm: card listings and dense rows
 * - md: page headers and prominent placements
 */
export const badgeSizeClasses: Record<BadgeSize, string> = {
  xs: "px-2 py-0.5 text-[10px] font-bold",
  sm: "px-2.5 py-0.5 text-xs font-semibold",
  md: "px-3 py-1 text-sm font-semibold",
};
