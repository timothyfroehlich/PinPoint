import { describe, expect, it } from "vitest";
import {
  APRON_BLEED_MM,
  apronCardsPerSheet,
  apronCutMarks,
  apronCutPositions,
  apronOrderLine,
  apronSheetGrid,
  apronSheetLabelPosition,
  apronSlotBleeds,
  imposeApronCards,
  type ApronSheetGrid,
} from "~/lib/machines/apron-imposition";
import type { ApronCardTemplate } from "~/lib/machines/apron-card";

const card = (id: string, template: ApronCardTemplate = "standard") => ({
  id,
  template,
});

describe("apronSheetGrid", () => {
  it.each([
    // 11 × 17 at a 4 mm edge margin (spec §12.6).
    ["stern", "tabloid", "narrow", 2, 3],
    ["wpc", "tabloid", "narrow", 2, 3],
    ["bally", "tabloid", "narrow", 3, 3],
    ["williams-em", "tabloid", "narrow", 2, 3],
    ["gottlieb-em", "tabloid", "narrow", 2, 3],
    ["bally-em", "tabloid", "narrow", 3, 2],
    // A ¼ in margin costs the two tall EM sizes a row, and Bally a column.
    ["bally", "tabloid", "standard", 2, 3],
    ["williams-em", "tabloid", "standard", 2, 2],
    ["bally-em", "tabloid", "standard", 2, 2],
    // 8.5 × 11 test print.
    ["wpc", "letter", "narrow", 1, 3],
    ["bally-em", "letter", "standard", 1, 2],
  ] as const)(
    "fits %s on %s with a %s margin as %i × %i",
    (size, paper, margin, cols, rows) => {
      const grid = apronSheetGrid(size, paper, margin);
      expect([grid.cols, grid.rows]).toEqual([cols, rows]);
    }
  );

  it("keeps the grid and its bleed inside the printable area, centered", () => {
    const grid = apronSheetGrid("bally", "tabloid", "narrow");
    const right = grid.originXMm + grid.cols * grid.cardWidthMm;
    expect(grid.originXMm - APRON_BLEED_MM).toBeGreaterThanOrEqual(4);
    expect(grid.pageWidthMm - right).toBeCloseTo(grid.originXMm, 6);
    expect(grid.pageWidthMm).toBeCloseTo(431.8, 6);
  });
});

describe("apronCutPositions", () => {
  it("lists the outer trims first, then the shared cuts between cards", () => {
    const { fromLeftMm, fromTopMm } = apronCutPositions(
      apronSheetGrid("wpc", "tabloid", "narrow")
    );
    // Two 6 in columns centered on 17 in: 2.5, 14.5, then 8.5 in.
    expect(fromLeftMm.map((mm) => mm / 25.4)).toEqual([
      expect.closeTo(2.5, 6),
      expect.closeTo(14.5, 6),
      expect.closeTo(8.5, 6),
    ]);
    // Three 3.25 in rows centered on 11 in.
    expect(fromTopMm.map((mm) => mm / 25.4)).toEqual([
      expect.closeTo(0.625, 6),
      expect.closeTo(10.375, 6),
      expect.closeTo(3.875, 6),
      expect.closeTo(7.125, 6),
    ]);
  });
});

describe("imposeApronCards", () => {
  const grid = apronSheetGrid("wpc", "tabloid", "narrow");

  it("fills each sheet column by column and starts a new sheet when full", () => {
    const sheets = imposeApronCards(
      Array.from({ length: 7 }, (_, i) => card(`c${i}`)),
      grid,
      { spares: false }
    );
    expect(sheets.map((sheet) => sheet.length)).toEqual([6, 1]);
    expect(sheets[0]?.map((s) => [s.col, s.row])).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
  });

  it("fills the last sheet's empty positions with spare copies in order", () => {
    const sheets = imposeApronCards([card("a"), card("b")], grid, {
      spares: true,
    });
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.map((s) => [s.card.id, s.spare])).toEqual([
      ["a", false],
      ["b", false],
      ["a", true],
      ["b", true],
      ["a", true],
      ["b", true],
    ]);
  });

  it("turns over every other column for panel templates and every other row for Header band", () => {
    const sheets = imposeApronCards(
      [card("band", "header-band"), card("std"), card("rail", "side-rail")],
      apronSheetGrid("bally", "tabloid", "narrow"),
      { spares: true }
    );
    const slots = sheets[0] ?? [];
    // Grouped by template: Standard, then Side rail, then Header band.
    expect(slots.slice(0, 3).map((s) => s.card.id)).toEqual([
      "std",
      "rail",
      "band",
    ]);
    for (const slot of slots) {
      expect(slot.rotated).toBe(
        slot.card.template === "header-band"
          ? slot.row % 2 === 1
          : slot.col % 2 === 1
      );
    }
  });

  it("produces no sheets for no cards", () => {
    expect(imposeApronCards([], grid, { spares: true })).toEqual([]);
  });
});

describe("apronSlotBleeds", () => {
  const grid = apronSheetGrid("wpc", "tabloid", "narrow");
  const right = (r: { xMm: number; widthMm: number }): number =>
    r.xMm + r.widthMm;

  it("bleeds an upright panel card past only the grid's outer edges", () => {
    // Top left card: left edge and top edge are outer, bottom is not.
    const bleeds = apronSlotBleeds(
      { col: 0, row: 0, rotated: false },
      "standard",
      "wpc",
      grid
    );
    expect(Math.min(...bleeds.map((r) => r.xMm))).toBeCloseTo(
      grid.originXMm - APRON_BLEED_MM,
      6
    );
    expect(Math.min(...bleeds.map((r) => r.yMm))).toBeCloseTo(
      grid.originYMm - APRON_BLEED_MM,
      6
    );
    const gridBottomOfCard = grid.originYMm + grid.cardHeightMm;
    for (const r of bleeds) {
      expect(r.yMm + r.heightMm).toBeLessThanOrEqual(gridBottomOfCard + 1e-6);
    }
  });

  it("bleeds a turned-over panel card past the grid's right edge", () => {
    const bleeds = apronSlotBleeds(
      { col: 1, row: 2, rotated: true },
      "standard",
      "wpc",
      grid
    );
    const gridRight = grid.originXMm + 2 * grid.cardWidthMm;
    expect(Math.max(...bleeds.map(right))).toBeCloseTo(
      gridRight + APRON_BLEED_MM,
      6
    );
    // Its panel's own top edge is now at the bottom of the grid.
    const gridBottom = grid.originYMm + 3 * grid.cardHeightMm;
    expect(Math.max(...bleeds.map((r) => r.yMm + r.heightMm))).toBeCloseTo(
      gridBottom + APRON_BLEED_MM,
      6
    );
  });

  it("prints no bleed for a card with no outer panel edge", () => {
    const middle: ApronSheetGrid = { ...grid, cols: 3, rows: 3 };
    expect(
      apronSlotBleeds(
        { col: 1, row: 1, rotated: false },
        "standard",
        "wpc",
        middle
      )
    ).toEqual([]);
  });
});

describe("apronCutMarks", () => {
  it("marks every cut line at both ends, white where it crosses the bleed", () => {
    const grid = apronSheetGrid("wpc", "tabloid", "narrow");
    const sheet =
      imposeApronCards(
        Array.from({ length: 6 }, (_, i) => card(`c${i}`)),
        grid,
        { spares: false }
      )[0] ?? [];
    const bleeds = sheet.flatMap((slot) =>
      apronSlotBleeds(slot, slot.card.template, "wpc", grid)
    );
    const marks = apronCutMarks(grid, bleeds);
    const { fromLeftMm, fromTopMm } = apronCutPositions(grid);
    for (const x of fromLeftMm) {
      const atX = marks.filter((m) => m.x1Mm === x && m.x2Mm === x);
      expect(atX.some((m) => m.y1Mm < grid.originYMm)).toBe(true);
      expect(atX.some((m) => m.y2Mm > grid.originYMm)).toBe(true);
    }
    for (const y of fromTopMm) {
      expect(marks.some((m) => m.y1Mm === y && m.y2Mm === y)).toBe(true);
    }
    // The left trim's top mark starts in the panel bleed.
    expect(
      marks.some(
        (m) =>
          m.color === "white" &&
          m.x1Mm === grid.originXMm &&
          m.y2Mm === grid.originYMm
      )
    ).toBe(true);
    for (const m of marks) {
      expect(Math.min(m.y1Mm, m.x1Mm)).toBeGreaterThanOrEqual(grid.marginMm);
    }
  });
});

describe("apronSheetLabelPosition", () => {
  it("puts the label below the cards when there is room", () => {
    const grid = apronSheetGrid("wpc", "tabloid", "narrow");
    const position = apronSheetLabelPosition(grid);
    expect(position.angle).toBe(0);
    expect(position.yMm).toBeGreaterThan(
      grid.originYMm + grid.rows * grid.cardHeightMm + APRON_BLEED_MM
    );
    expect(position.yMm).toBeLessThanOrEqual(grid.pageHeightMm - grid.marginMm);
  });

  it("runs the label up the side when the grid fills the page's height", () => {
    const grid = apronSheetGrid("williams-em", "tabloid", "narrow");
    expect(apronSheetLabelPosition(grid).angle).toBe(90);
  });
});

describe("apronOrderLine", () => {
  it("counts cards and spares and gives the cuts in inches", () => {
    const grid = apronSheetGrid("gottlieb-em", "tabloid", "narrow");
    const sheets = imposeApronCards([card("rf")], grid, { spares: true });
    expect(apronCardsPerSheet(grid)).toBe(6);
    expect(apronOrderLine("gottlieb-em", grid, sheets)).toEqual({
      size: "gottlieb-em",
      sheets: 1,
      cards: 1,
      spares: 5,
      cutsFromLeftIn: ["2.50", "14.50", "8.50"],
      cutsFromTopIn: ["1.00", "10.00", "4.00", "7.00"],
    });
  });
});
