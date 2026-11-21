import { describe, expect, it } from "vitest";
import {
  fitLineParts,
  fitPrimaryFilters,
  LINE_FIT_TOLERANCE,
  phoneSearchAsIcon,
  planLineParts,
  planListHeader,
  type LineFitPart,
  type LinePartFit,
} from "./overflow";

describe("phoneSearchAsIcon (list-views §7.12, §8.7)", () => {
  // The views button: icon 16 + gap 8 + name + gap 8 + chevron 16.
  const openIssues = 48 + 94;
  // Filters 44 plus two 8px gaps.
  const besideField = 60;
  const fit = (available: number, viewsWidth: number): boolean =>
    phoneSearchAsIcon({ available, viewsWidth, filtersWidth: 44, gap: 8 });

  it("keeps the field on a 400px screen with Open issues", () => {
    // 400 - 16 left - 6 right padding = 378; 378 - 142 - 44 - 16 = 176.
    expect(fit(378, openIssues)).toBe(false);
  });

  it("switches a tolerance pixel early, so a field of exactly 175px is an icon", () => {
    expect(fit(176 + openIssues + besideField, openIssues)).toBe(false);
    expect(fit(175 + openIssues + besideField, openIssues)).toBe(true);
    expect(fit(174 + openIssues + besideField, openIssues)).toBe(true);
  });

  it("shows the icon on a 320px screen", () => {
    // 320 - 22 padding = 298; 298 - 142 - 60 = 96.
    expect(fit(298, openIssues)).toBe(true);
  });

  it("switches sooner for the Edited marker", () => {
    // The Edited marker adds its 8px dot and an 8px gap: 176 - 16 = 160.
    expect(fit(378, openIssues + 16)).toBe(true);
    // Wide enough for the marker too: 394 - 158 - 60 = 176.
    expect(fit(394, openIssues + 16)).toBe(false);
  });

  it("switches sooner for a longer view name", () => {
    expect(fit(378, 48 + 140)).toBe(true);
    // 430 - 22 = 408; 408 - 188 - 60 = 160, still an icon on a large phone.
    expect(fit(408, 48 + 140)).toBe(true);
  });
});

describe("fitLineParts (machine-views §5.10, issues-list §3.9)", () => {
  // Gaps 6px in the leading group, 8px in the trailing group, 12px between
  // the groups; a "·" is 4px wide.
  const spacing = { gap: 6, trailingGap: 8, groupGap: 12, separatorWidth: 4 };

  describe("an issue row's line 2", () => {
    // Leading: ID 60 (text) · machine 120 (text, truncating down to 44),
    // priority 50. Trailing: assignee 30, comments 40, age 90.
    type Part = "id" | "machine" | "priority" | "assignee" | "comments" | "age";
    const leading = (machineWidth = 120): LineFitPart<Part>[] => [
      { key: "id", width: 60, text: true },
      { key: "machine", width: machineWidth, text: true, minWidth: 44 },
      { key: "priority", width: 50, text: false },
    ];
    const trailing: LineFitPart<Part>[] = [
      { key: "assignee", width: 30, text: false },
      { key: "comments", width: 40, text: false },
      { key: "age", width: 90, text: false },
    ];
    const dropOrder: Part[] = [
      "age",
      "comments",
      "machine",
      "priority",
      "assignee",
    ];
    const plan = (
      available: number,
      machineWidth?: number
    ): Record<string, LinePartFit> =>
      Object.fromEntries(
        planLineParts({
          ...spacing,
          available,
          leading: leading(machineWidth),
          trailing,
          dropOrder,
        })
      );
    const shown = (available: number): string[] =>
      [
        ...fitLineParts({
          ...spacing,
          available,
          leading: leading(),
          trailing,
          dropOrder,
        }),
      ].sort();

    it("keeps every part at full width when the line fits with the tolerance to spare", () => {
      // (60+6+4+6+120+6+50) + 12 + (30+8+40+8+90) = 440.
      expect(plan(440 + LINE_FIT_TOLERANCE)).toEqual({
        id: "full",
        machine: "full",
        priority: "full",
        assignee: "full",
        comments: "full",
        age: "full",
      });
    });

    it("drops the age, then the comment count, before touching the machine name", () => {
      expect(plan(439 + LINE_FIT_TOLERANCE)).toMatchObject({
        age: "hidden",
        comments: "full",
        machine: "full",
      });
      // 252 + 12 + (30+8+40) = 342.
      expect(plan(341 + LINE_FIT_TOLERANCE)).toMatchObject({
        comments: "hidden",
        machine: "full",
      });
    });

    it("truncates the machine name while the priority and assignee still show", () => {
      // 252 + 12 + 30 = 294 with the name at full width.
      expect(plan(294 + LINE_FIT_TOLERANCE)).toMatchObject({
        machine: "full",
        priority: "full",
        assignee: "full",
      });
      expect(plan(293 + LINE_FIT_TOLERANCE)).toMatchObject({
        id: "full",
        machine: "truncated",
        priority: "full",
        assignee: "full",
      });
      // 76px narrower leaves the name at exactly its 44px minimum.
      expect(plan(218 + LINE_FIT_TOLERANCE)).toMatchObject({
        machine: "truncated",
        priority: "full",
        assignee: "full",
      });
    });

    it("hides the machine name, below its minimum, before the priority drops", () => {
      expect(plan(217 + LINE_FIT_TOLERANCE)).toEqual({
        id: "full",
        machine: "hidden",
        priority: "full",
        assignee: "full",
        comments: "hidden",
        age: "hidden",
      });
    });

    it("takes the machine name's separator with it", () => {
      // Without the name or its "·": (60+6+50) + 12 + 30 = 158. A "·" left
      // behind would make it 168.
      expect(shown(158 + LINE_FIT_TOLERANCE)).toEqual([
        "assignee",
        "id",
        "priority",
      ]);
    });

    it("then drops the priority, then the assignee", () => {
      // 60 + 12 + 30 = 102.
      expect(shown(157 + LINE_FIT_TOLERANCE)).toEqual(["assignee", "id"]);
      expect(shown(102 + LINE_FIT_TOLERANCE)).toEqual(["assignee", "id"]);
      expect(shown(101 + LINE_FIT_TOLERANCE)).toEqual(["id"]);
    });

    it("hides a name already narrower than its minimum instead of truncating it", () => {
      // A 40px name: (60+6+4+6+40+6+50) + 12 + 30 = 214.
      expect(plan(214 + LINE_FIT_TOLERANCE, 40)).toMatchObject({
        machine: "full",
      });
      expect(plan(213 + LINE_FIT_TOLERANCE, 40)).toMatchObject({
        machine: "hidden",
        priority: "full",
      });
    });

    it("never drops a part outside the drop order", () => {
      expect(shown(10)).toEqual(["id"]);
    });
  });

  describe("a machine row's line 2", () => {
    // Leading: Playability 80 · manufacturer 70 · year 40 (text), owner 20.
    // Trailing: the service age 60.
    type Part = "playability" | "manufacturer" | "year" | "owner" | "serviced";
    const leading: LineFitPart<Part>[] = [
      { key: "playability", width: 80, text: true },
      { key: "manufacturer", width: 70, text: true },
      { key: "year", width: 40, text: true },
      { key: "owner", width: 20, text: false },
    ];
    const trailing: LineFitPart<Part>[] = [
      { key: "serviced", width: 60, text: false },
    ];
    const dropOrder: Part[] = ["year", "manufacturer", "serviced", "owner"];
    const shown = (available: number): string[] =>
      [
        ...fitLineParts({
          ...spacing,
          available,
          leading,
          trailing,
          dropOrder,
        }),
      ].sort();

    it("puts a separator only between two plain-text parts", () => {
      // (80+6+4+6+70+6+4+6+40+6+20) + 12 + 60 = 320: two separators, none
      // before the owner.
      expect(shown(320 + LINE_FIT_TOLERANCE)).toHaveLength(5);
      // Without the year: (80+6+4+6+70+6+20) + 12 + 60 = 264.
      expect(shown(319 + LINE_FIT_TOLERANCE)).toEqual([
        "manufacturer",
        "owner",
        "playability",
        "serviced",
      ]);
      expect(shown(264 + LINE_FIT_TOLERANCE)).toHaveLength(4);
    });

    it("drops year, manufacturer, the service age, then the owner", () => {
      // (80+6+20) + 12 + 60 = 178.
      expect(shown(178 + LINE_FIT_TOLERANCE)).toEqual([
        "owner",
        "playability",
        "serviced",
      ]);
      // The trailing group takes no room once it is gone: 80+6+20 = 106.
      expect(shown(106 + LINE_FIT_TOLERANCE)).toEqual(["owner", "playability"]);
      expect(shown(105 + LINE_FIT_TOLERANCE)).toEqual(["playability"]);
    });
  });
});

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

  it("keeps no tab in place when there is no Applied View", () => {
    // Save view (90) takes the edit slot; every tab may leave.
    const noApplied = {
      ...base,
      appliedIndex: null,
      editWidth: 90,
      editCompactWidth: 90,
    };
    expect(
      planListHeader({ ...noApplied, available: 100 + 2 + 90 + 202 })
    ).toEqual({
      visibleTabs: [],
      showMoreViews: true,
      pager: "hidden",
      compactEdit: false,
    });
    expect(planListHeader({ ...noApplied, available: 50 }).visibleTabs).toEqual(
      []
    );
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
