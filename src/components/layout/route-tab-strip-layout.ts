const FIT_TOLERANCE_PX = 1;

export interface TabLayoutPlan {
  readonly visibleIndices: readonly number[];
  readonly overflowIndices: readonly number[];
  /** The active link is painted beneath the pinned trigger and repeated in the menu. */
  readonly activeClipped: boolean;
}

interface PlanTabLayoutOptions {
  readonly availableWidth: number;
  readonly tabWidths: readonly number[];
  readonly overflowTriggerWidth: number;
  readonly activeIndex: number | null;
}

/**
 * Decide which route links fit without encoding viewport breakpoints. The
 * active route is selected first, then inactive routes in source order. When
 * the active route cannot share the row with the overflow trigger, it remains
 * painted beneath that pinned trigger and is repeated in the menu.
 */
export function planTabLayout({
  availableWidth,
  tabWidths,
  overflowTriggerWidth,
  activeIndex,
}: PlanTabLayoutOptions): TabLayoutPlan {
  const allIndices = tabWidths.map((_, index) => index);
  const totalWidth = tabWidths.reduce((sum, width) => sum + width, 0);

  if (totalWidth <= availableWidth) {
    return {
      visibleIndices: allIndices,
      overflowIndices: [],
      activeClipped: false,
    };
  }

  const roomForTabs = Math.max(
    0,
    availableWidth - overflowTriggerWidth - FIT_TOLERANCE_PX
  );
  const visible = new Set<number>();
  let usedWidth = 0;
  let activeClipped = false;

  if (activeIndex !== null) {
    const activeWidth = tabWidths[activeIndex];
    if (activeWidth !== undefined) {
      visible.add(activeIndex);
      if (activeWidth <= roomForTabs) {
        usedWidth = activeWidth;
      } else {
        activeClipped = true;
      }
    }
  }

  if (!activeClipped) {
    for (const index of allIndices) {
      if (index === activeIndex) continue;
      const width = tabWidths[index];
      if (width !== undefined && usedWidth + width <= roomForTabs) {
        visible.add(index);
        usedWidth += width;
      }
    }
  }

  return {
    visibleIndices: allIndices.filter((index) => visible.has(index)),
    overflowIndices: allIndices.filter(
      (index) => !visible.has(index) || (activeClipped && index === activeIndex)
    ),
    activeClipped,
  };
}
