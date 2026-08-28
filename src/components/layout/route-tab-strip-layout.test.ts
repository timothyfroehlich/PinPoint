import { describe, expect, it } from "vitest";

import { planTabLayout } from "~/components/layout/route-tab-strip-layout";

describe("planTabLayout", () => {
  it("keeps every tab visible when they fit without a trigger", () => {
    expect(
      planTabLayout({
        availableWidth: 180,
        tabWidths: [50, 60, 70],
        overflowTriggerWidth: 48,
        activeIndex: 0,
      })
    ).toEqual({
      visibleIndices: [0, 1, 2],
      overflowIndices: [],
      activeClipped: false,
    });
  });

  it("reserves the trigger, preserves the active tab, and keeps route order", () => {
    expect(
      planTabLayout({
        availableWidth: 184,
        tabWidths: [45, 80, 45, 45],
        overflowTriggerWidth: 48,
        activeIndex: 3,
      })
    ).toEqual({
      visibleIndices: [0, 2, 3],
      overflowIndices: [1],
      activeClipped: false,
    });
  });

  it("responds to badge-driven width changes", () => {
    const withoutWideBadge = planTabLayout({
      availableWidth: 210,
      tabWidths: [60, 60, 60],
      overflowTriggerWidth: 48,
      activeIndex: 2,
    });
    const withWideBadge = planTabLayout({
      availableWidth: 210,
      tabWidths: [60, 100, 60],
      overflowTriggerWidth: 48,
      activeIndex: 2,
    });

    expect(withoutWideBadge.overflowIndices).toEqual([]);
    expect(withWideBadge.overflowIndices).toEqual([1]);
  });

  it("lets the pinned trigger take precedence over an oversized active tab", () => {
    expect(
      planTabLayout({
        availableWidth: 120,
        tabWidths: [140, 40],
        overflowTriggerWidth: 48,
        activeIndex: 0,
      })
    ).toEqual({
      visibleIndices: [0],
      overflowIndices: [0, 1],
      activeClipped: true,
    });
  });

  it("leaves only the trigger fully usable when no active route can fit", () => {
    expect(
      planTabLayout({
        availableWidth: 40,
        tabWidths: [80, 80],
        overflowTriggerWidth: 48,
        activeIndex: null,
      })
    ).toEqual({
      visibleIndices: [],
      overflowIndices: [0, 1],
      activeClipped: false,
    });
  });
});
