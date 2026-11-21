import { describe, expect, it } from "vitest";
import {
  FIT_TOLERANCE,
  planPageActions,
  type PageActionWidths,
} from "./overflow";

// Machines (machine-views §6.6–§6.8): Pinball Map, Add Machine, then ⋯.
const map: PageActionWidths = { key: "map", labeled: 120, icon: 36 };
const add: PageActionWidths = { key: "add", labeled: 126, icon: 36 };
const more = { labeled: 96, icon: 36 };
const GAP = 8;
// Labeled: 120 + 126 + 96 + 2 gaps = 358. Icons: 3 × 36 + 2 gaps = 124.
const LABELED = 358;
const ICONS = 124;

function machines(available: number): ReturnType<typeof planPageActions> {
  return planPageActions({
    available,
    actions: [map, add],
    more,
    moreHasItems: true,
    foldSteps: [["map"], ["add"]],
    gap: GAP,
  });
}

describe("planPageActions (list-views §3.7–§3.9, §8.11, §8.12)", () => {
  it("shows every action with its label while they fit with the tolerance spare", () => {
    expect(machines(LABELED + FIT_TOLERANCE)).toEqual({
      shown: ["map", "add"],
      folded: [],
      labeled: true,
      showMore: true,
    });
  });

  it("turns every action into an icon, ⋯ included, once the labels no longer fit", () => {
    // One pixel short of the tolerance: the step fires before the overflow.
    expect(machines(LABELED + FIT_TOLERANCE - 1)).toEqual({
      shown: ["map", "add"],
      folded: [],
      labeled: false,
      showMore: true,
    });
  });

  it("folds Pinball Map first, and the rest show their labels again when they fit", () => {
    // Add Machine + Actions labeled: 126 + 8 + 96 = 230.
    expect(machines(ICONS + FIT_TOLERANCE - 1)).toEqual({
      shown: ["add"],
      folded: ["map"],
      labeled: false,
      showMore: true,
    });
    const wider = planPageActions({
      available: 240 + FIT_TOLERANCE,
      actions: [map, { ...add, icon: 200 }],
      more,
      moreHasItems: true,
      foldSteps: [["map"], ["add"]],
      gap: GAP,
    });
    expect(wider).toEqual({
      shown: ["add"],
      folded: ["map"],
      labeled: true,
      showMore: true,
    });
  });

  it("folds Add Machine last, leaving a lone ⋯ that shows its label when it fits", () => {
    expect(machines(80 + FIT_TOLERANCE - 1)).toEqual({
      shown: [],
      folded: ["map", "add"],
      labeled: false,
      showMore: true,
    });
    expect(
      planPageActions({
        available: 100 + FIT_TOLERANCE,
        actions: [map, { ...add, icon: 200 }],
        more,
        moreHasItems: true,
        foldSteps: [["map"], ["add"]],
        gap: GAP,
      })
    ).toEqual({
      shown: [],
      folded: ["map", "add"],
      labeled: true,
      showMore: true,
    });
  });

  it("keeps the last step's icons when nothing fits at all", () => {
    expect(machines(10)).toEqual({
      shown: [],
      folded: ["map", "add"],
      labeled: false,
      showMore: true,
    });
  });

  it("folds actions that share a step together (list-views §3.9)", () => {
    const share = { key: "share", labeled: 90, icon: 36 };
    const print = { key: "print", labeled: 90, icon: 36 };
    expect(
      planPageActions({
        available: 100,
        actions: [share, print],
        more,
        moreHasItems: true,
        foldSteps: [["share", "print"]],
        gap: GAP,
      })
    ).toEqual({
      shown: [],
      folded: ["share", "print"],
      labeled: false,
      showMore: true,
    });
  });

  it("shows ⋯ only while it holds something", () => {
    const print = { key: "print", labeled: 90, icon: 36 };
    const input = {
      actions: [print],
      more,
      moreHasItems: false,
      foldSteps: [["share", "print"]],
      gap: GAP,
    };
    expect(planPageActions({ ...input, available: 200 })).toEqual({
      shown: ["print"],
      folded: [],
      labeled: true,
      showMore: false,
    });
    // Folding Print gives ⋯ something to hold.
    expect(planPageActions({ ...input, available: 40 })).toEqual({
      shown: [],
      folded: ["print"],
      labeled: false,
      showMore: true,
    });
  });

  it("skips a fold step whose actions the viewer does not have", () => {
    // A viewer who cannot open the lineup has no Pinball Map to fold.
    expect(
      planPageActions({
        available: 50,
        actions: [add],
        more,
        moreHasItems: true,
        foldSteps: [["map"], ["add"]],
        gap: GAP,
      })
    ).toEqual({
      shown: [],
      folded: ["add"],
      labeled: false,
      showMore: true,
    });
  });

  it("shows a lone ⋯ when a page has no other actions (issues-list 2.3)", () => {
    expect(
      planPageActions({
        available: 300,
        actions: [],
        more,
        moreHasItems: true,
        foldSteps: [],
        gap: GAP,
      })
    ).toEqual({ shown: [], folded: [], labeled: true, showMore: true });
  });

  describe("a lone entry (list-views §3.7)", () => {
    // A tag page: Share, and Print settings sheets as ⋯'s only entry.
    const share: PageActionWidths = { key: "share", labeled: 90, icon: 36 };
    const print: PageActionWidths = { key: "print", labeled: 170, icon: 36 };
    function tag(available: number): ReturnType<typeof planPageActions> {
      return planPageActions({
        available,
        actions: [share],
        more,
        moreHasItems: false,
        loneEntry: print,
        foldSteps: [["share"]],
        gap: GAP,
      });
    }

    it("shows it as the last button, with no ⋯, while there is room", () => {
      // Labeled: 90 + 8 + 170 = 268.
      expect(tag(268 + FIT_TOLERANCE)).toEqual({
        shown: ["share", "print"],
        folded: [],
        labeled: true,
        showMore: false,
      });
      // Icons: 36 + 8 + 36 = 80.
      expect(tag(80 + FIT_TOLERANCE)).toEqual({
        shown: ["share", "print"],
        folded: [],
        labeled: false,
        showMore: false,
      });
    });

    it("folds it after every fold step, so ⋯ holds it alone only when space forces it", () => {
      expect(tag(36 + FIT_TOLERANCE)).toEqual({
        shown: [],
        folded: ["share", "print"],
        labeled: false,
        showMore: true,
      });
      // Issues (issues-list 2.3): Export alone folds into a lone ⋯.
      const exportEntry = { key: "export", labeled: 80, icon: 36 };
      const issues = (available: number): ReturnType<typeof planPageActions> =>
        planPageActions({
          available,
          actions: [],
          more,
          moreHasItems: false,
          loneEntry: exportEntry,
          foldSteps: [],
          gap: GAP,
        });
      expect(issues(80 + FIT_TOLERANCE)).toEqual({
        shown: ["export"],
        folded: [],
        labeled: true,
        showMore: false,
      });
      expect(issues(30)).toEqual({
        shown: [],
        folded: ["export"],
        labeled: false,
        showMore: true,
      });
    });
  });
});
