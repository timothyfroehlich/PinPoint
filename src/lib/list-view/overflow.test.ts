import { describe, expect, it } from "vitest";
import { fitPrimaryFilters, planListHeader } from "./overflow";

describe("fitPrimaryFilters (list-views §8.1)", () => {
  const filterWidths = [120, 100, 110, 80];

  it("keeps every filter inline, with no More, when they fit", () => {
    expect(
      fitPrimaryFilters({
        available: 500,
        filterWidths,
        moreWidth: 70,
        hasSecondary: false,
        gap: 2,
      })
    ).toBe(4);
  });

  it("moves filters into More from the right, one at a time", () => {
    // 120+100+110 + More 70 + 3 gaps = 406.
    expect(
      fitPrimaryFilters({
        available: 406,
        filterWidths,
        moreWidth: 70,
        hasSecondary: false,
        gap: 2,
      })
    ).toBe(3);
    expect(
      fitPrimaryFilters({
        available: 405,
        filterWidths,
        moreWidth: 70,
        hasSecondary: false,
        gap: 2,
      })
    ).toBe(2);
  });

  it("reserves room for More whenever the host has Secondary Filters", () => {
    expect(
      fitPrimaryFilters({
        available: 416,
        filterWidths,
        moreWidth: 70,
        hasSecondary: true,
        gap: 2,
      })
    ).toBe(3);
  });

  it("can move every filter into More", () => {
    expect(
      fitPrimaryFilters({
        available: 60,
        filterWidths,
        moreWidth: 70,
        hasSecondary: false,
        gap: 2,
      })
    ).toBe(0);
  });
});

describe("planListHeader (list-views §8.2, §8.3)", () => {
  const base = {
    tabWidths: [100, 120, 90, 110, 130],
    appliedIndex: 0,
    moreViewsWidth: 100,
    moreViewsAlways: true,
    editWidth: 0,
    editCompactWidth: 0,
    pagerWidths: { full: 130, compact: 70 },
    controlsWidth: 200,
    gap: 2,
  };
  // Five tabs (550) and More views (100) with five gaps between them = 660;
  // the pager (130) and the controls (200) each add their own gap.
  const everything = 660 + 132 + 202;

  it("shows every tab, More views, and the full compact pager when they fit", () => {
    expect(planListHeader({ ...base, available: everything })).toEqual({
      visibleTabs: [0, 1, 2, 3, 4],
      showMoreViews: true,
      pager: "full",
      compactEdit: false,
    });
  });

  it("hides More views when it would hold nothing and every tab fits", () => {
    expect(
      planListHeader({
        ...base,
        moreViewsAlways: false,
        available: everything,
      }).showMoreViews
    ).toBe(false);
  });

  it("moves tabs into More views from the right before touching the pager", () => {
    expect(planListHeader({ ...base, available: everything - 1 })).toEqual({
      visibleTabs: [0, 1, 2, 3],
      showMoreViews: true,
      pager: "full",
      compactEdit: false,
    });
  });

  it("always keeps the Applied View's tab, wherever it sits", () => {
    const plan = planListHeader({
      ...base,
      appliedIndex: 4,
      available: 100 + 2 + 130 + 2 + 100 + 132 + 202,
    });
    expect(plan.visibleTabs).toEqual([0, 4]);
  });

  it("then drops the range text, then the compact pager", () => {
    const appliedOnly = 100 + 2 + 100 + 2 + 202;
    expect(planListHeader({ ...base, available: appliedOnly + 72 }).pager).toBe(
      "compact"
    );
    expect(planListHeader({ ...base, available: appliedOnly }).pager).toBe(
      "hidden"
    );
  });

  it("shortens Discard changes only after the pager is gone", () => {
    const edited = { ...base, editWidth: 200, editCompactWidth: 150 };
    const appliedOnly = 100 + 2 + 100 + 2 + 202;
    expect(
      planListHeader({ ...edited, available: appliedOnly + 202 })
    ).toMatchObject({ pager: "hidden", compactEdit: false });
    expect(
      planListHeader({ ...edited, available: appliedOnly + 152 })
    ).toMatchObject({ pager: "hidden", compactEdit: true });
  });

  it("falls back to the Applied View alone when nothing else fits", () => {
    expect(planListHeader({ ...base, available: 100 })).toEqual({
      visibleTabs: [0],
      showMoreViews: true,
      pager: "hidden",
      compactEdit: true,
    });
  });
});
