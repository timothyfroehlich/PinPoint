import {
  APRON_CARD_LAYOUTS,
  APRON_CARD_SIZES,
  APRON_HEADER_BAND_LAYOUTS,
  APRON_SIDE_RAIL_LAYOUTS,
  type ApronCardSize,
  type ApronCardTemplate,
} from "~/lib/machines/apron-card";

/**
 * Batch printing (spec apron-cards §12): laying a file's cards out on print
 * sheets. Every measurement here is in mm on the page, origin top left.
 */

/** The papers a print run can use (§12.6), portrait dimensions. */
export const APRON_PRINT_PAPERS = {
  tabloid: { label: "11 × 17 in", widthMm: 279.4, heightMm: 431.8 },
  letter: { label: "8.5 × 11 in", widthMm: 215.9, heightMm: 279.4 },
} as const;

export type ApronPrintPaper = keyof typeof APRON_PRINT_PAPERS;

/** How close to the paper's edge the shop's printer can print (§12.6). */
export const APRON_PRINT_MARGINS = {
  narrow: { label: "4 mm", mm: 4 },
  standard: { label: "¼ in", mm: 6.35 },
} as const;

export type ApronPrintMargin = keyof typeof APRON_PRINT_MARGINS;

/** How far the dark panel or band prints past an outer trim edge. */
export const APRON_BLEED_MM = 2;

/** The panel and band color (`.apron-card__panel` in apron-card.css). */
export const APRON_PANEL_COLOR = "#0f0f11";

const PX_TO_MM = 25.4 / 96;

/** Floating-point slack so cards that fit exactly are not rejected. */
const FIT_EPSILON_MM = 0.001;

export interface ApronSheetGrid {
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
  cols: number;
  rows: number;
  cardWidthMm: number;
  cardHeightMm: number;
  /** Top left corner of the first card's trim. */
  originXMm: number;
  originYMm: number;
}

/**
 * The grid for one apron size: cards stay upright on the page, and the page
 * turns to whichever orientation holds more of them (landscape on a tie).
 * The grid is centered, and leaves room for the bleed inside the printable
 * area on every side.
 */
export function apronSheetGrid(
  size: ApronCardSize,
  paper: ApronPrintPaper,
  margin: ApronPrintMargin
): ApronSheetGrid {
  const { widthMm: cardWidthMm, heightMm: cardHeightMm } =
    APRON_CARD_SIZES[size];
  const { widthMm, heightMm } = APRON_PRINT_PAPERS[paper];
  const marginMm = APRON_PRINT_MARGINS[margin].mm;
  const inset = 2 * (marginMm + APRON_BLEED_MM);
  const layout = (
    pageWidthMm: number,
    pageHeightMm: number
  ): ApronSheetGrid => {
    const cols = Math.floor(
      (pageWidthMm - inset + FIT_EPSILON_MM) / cardWidthMm
    );
    const rows = Math.floor(
      (pageHeightMm - inset + FIT_EPSILON_MM) / cardHeightMm
    );
    return {
      pageWidthMm,
      pageHeightMm,
      marginMm,
      cols,
      rows,
      cardWidthMm,
      cardHeightMm,
      originXMm: (pageWidthMm - cols * cardWidthMm) / 2,
      originYMm: (pageHeightMm - rows * cardHeightMm) / 2,
    };
  };
  const landscape = layout(heightMm, widthMm);
  const portrait = layout(widthMm, heightMm);
  return portrait.cols * portrait.rows > landscape.cols * landscape.rows
    ? portrait
    : landscape;
}

export function apronCardsPerSheet(grid: ApronSheetGrid): number {
  return grid.cols * grid.rows;
}

/**
 * The cut lines, in cutting order: the two outer trims, then the lines
 * between cards. Neighbouring cards share one cut (§12.7).
 */
export function apronCutPositions(grid: ApronSheetGrid): {
  fromLeftMm: number[];
  fromTopMm: number[];
} {
  const lines = (origin: number, step: number, count: number): number[] => {
    const inner = Array.from(
      { length: count - 1 },
      (_, i) => origin + (i + 1) * step
    );
    return [origin, origin + count * step, ...inner];
  };
  return {
    fromLeftMm: lines(grid.originXMm, grid.cardWidthMm, grid.cols),
    fromTopMm: lines(grid.originYMm, grid.cardHeightMm, grid.rows),
  };
}

export interface ApronSheetSlot<T> {
  card: T;
  /** A spare copy filling a position no selected card needs (§12.8). */
  spare: boolean;
  col: number;
  row: number;
  /** Printed upside down so its edges match its neighbours' (§12.7). */
  rotated: boolean;
}

const TEMPLATE_ORDER: Record<ApronCardTemplate, number> = {
  standard: 0,
  "side-rail": 1,
  "header-band": 2,
};

/**
 * Whether a card prints upside down. A panel template bleeds its left edge,
 * so every other column turns over and panels meet panels; a Header band
 * bleeds its top edge, so every other row turns over and bands meet bands.
 */
function isRotated(
  template: ApronCardTemplate,
  col: number,
  row: number
): boolean {
  return template === "header-band" ? row % 2 === 1 : col % 2 === 1;
}

/**
 * Places a file's cards on its sheets, column by column. Cards are grouped by
 * template so like edges sit together. With spares on, the last sheet's empty
 * positions take copies of the file's cards in order.
 */
export function imposeApronCards<T extends { template: ApronCardTemplate }>(
  cards: readonly T[],
  grid: ApronSheetGrid,
  { spares }: { spares: boolean }
): ApronSheetSlot<T>[][] {
  const perSheet = apronCardsPerSheet(grid);
  if (cards.length === 0 || perSheet === 0) return [];
  const ordered = cards
    .map((card, index) => ({ card, index }))
    .sort(
      (a, b) =>
        TEMPLATE_ORDER[a.card.template] - TEMPLATE_ORDER[b.card.template] ||
        a.index - b.index
    )
    .map(({ card }) => card);
  const sheetCount = Math.ceil(ordered.length / perSheet);
  const total = spares ? sheetCount * perSheet : ordered.length;
  const sheets: ApronSheetSlot<T>[][] = [];
  for (let i = 0; i < total; i++) {
    const position = i % perSheet;
    const col = Math.floor(position / grid.rows);
    const row = position % grid.rows;
    const spare = i >= ordered.length;
    const card = ordered[i % ordered.length];
    if (card === undefined) continue;
    if (position === 0) sheets.push([]);
    sheets.at(-1)?.push({
      card,
      spare,
      col,
      row,
      rotated: isRotated(card.template, col, row),
    });
  }
  return sheets;
}

export interface ApronRect {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

type Side = "left" | "right" | "top" | "bottom";

const OPPOSITE: Record<Side, Side> = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
};

/**
 * The bleed a card prints past the grid's outer edges. A card's dark panel
 * (or band) runs past each trim edge it touches, but only where that edge is
 * the outside of the grid: between cards there is no bleed, so a card never
 * prints onto its neighbour and no gap is needed.
 */
export function apronSlotBleeds(
  slot: Pick<ApronSheetSlot<unknown>, "col" | "row" | "rotated">,
  template: ApronCardTemplate,
  size: ApronCardSize,
  grid: ApronSheetGrid
): ApronRect[] {
  const w = grid.cardWidthMm;
  const h = grid.cardHeightMm;
  const b = APRON_BLEED_MM;
  // Pieces in the upright card's own frame, each with the sides it lies past.
  type Piece = [x0: number, y0: number, x1: number, y1: number, Side[]];
  let pieces: Piece[];
  if (template === "header-band") {
    const q = APRON_HEADER_BAND_LAYOUTS[size].bandHeight * PX_TO_MM;
    pieces = [
      [0, -b, w, 0, ["top"]],
      [-b, 0, 0, q, ["left"]],
      [w, 0, w + b, q, ["right"]],
      [-b, -b, 0, 0, ["left", "top"]],
      [w, -b, w + b, 0, ["right", "top"]],
    ];
  } else {
    const layouts =
      template === "side-rail" ? APRON_SIDE_RAIL_LAYOUTS : APRON_CARD_LAYOUTS;
    const p = layouts[size].panelWidth * PX_TO_MM;
    pieces = [
      [-b, 0, 0, h, ["left"]],
      [0, -b, p, 0, ["top"]],
      [0, h, p, h + b, ["bottom"]],
      [-b, -b, 0, 0, ["left", "top"]],
      [-b, h, 0, h + b, ["left", "bottom"]],
    ];
  }
  const outer: Record<Side, boolean> = {
    left: slot.col === 0,
    right: slot.col === grid.cols - 1,
    top: slot.row === 0,
    bottom: slot.row === grid.rows - 1,
  };
  const cardX = grid.originXMm + slot.col * w;
  const cardY = grid.originYMm + slot.row * h;
  return pieces.flatMap(([x0, y0, x1, y1, sides]) => {
    const [rx0, ry0, rx1, ry1] = slot.rotated
      ? [w - x1, h - y1, w - x0, h - y0]
      : [x0, y0, x1, y1];
    const onSheet = slot.rotated ? sides.map((side) => OPPOSITE[side]) : sides;
    if (!onSheet.every((side) => outer[side])) return [];
    return [
      {
        xMm: cardX + rx0,
        yMm: cardY + ry0,
        widthMm: rx1 - rx0,
        heightMm: ry1 - ry0,
      },
    ];
  });
}

export interface ApronCutMark {
  x1Mm: number;
  y1Mm: number;
  x2Mm: number;
  y2Mm: number;
  /** White where the mark crosses the dark bleed, black on bare paper. */
  color: "black" | "white";
}

/**
 * A short mark at the sheet's edge on every cut line (§12.9), running from
 * the trim out to the printable edge. The part crossing a bleed prints white.
 */
export function apronCutMarks(
  grid: ApronSheetGrid,
  bleeds: readonly ApronRect[]
): ApronCutMark[] {
  const { fromLeftMm, fromTopMm } = apronCutPositions(grid);
  const left = grid.originXMm;
  const right = grid.originXMm + grid.cols * grid.cardWidthMm;
  const top = grid.originYMm;
  const bottom = grid.originYMm + grid.rows * grid.cardHeightMm;
  const m = grid.marginMm;
  const marks: ApronCutMark[] = [];
  // Splits one axis-aligned mark at the bleed rectangles it crosses.
  const split = (
    fixed: number,
    from: number,
    to: number,
    vertical: boolean
  ): void => {
    if (to - from <= 0) return;
    const cuts = bleeds
      .filter((r) =>
        vertical
          ? fixed >= r.xMm && fixed <= r.xMm + r.widthMm
          : fixed >= r.yMm && fixed <= r.yMm + r.heightMm
      )
      .map((r) =>
        vertical
          ? [Math.max(from, r.yMm), Math.min(to, r.yMm + r.heightMm)]
          : [Math.max(from, r.xMm), Math.min(to, r.xMm + r.widthMm)]
      )
      .filter(([a = 0, z = 0]) => z > a)
      .sort(([a = 0], [c = 0]) => a - c);
    let at = from;
    const push = (a: number, z: number, color: ApronCutMark["color"]): void => {
      if (z - a <= 0) return;
      marks.push(
        vertical
          ? { x1Mm: fixed, y1Mm: a, x2Mm: fixed, y2Mm: z, color }
          : { x1Mm: a, y1Mm: fixed, x2Mm: z, y2Mm: fixed, color }
      );
    };
    for (const [a = 0, z = 0] of cuts) {
      push(at, Math.max(at, a), "black");
      push(Math.max(at, a), z, "white");
      at = Math.max(at, z);
    }
    push(at, to, "black");
  };
  for (const x of fromLeftMm) {
    split(x, m, top, true);
    split(x, bottom, grid.pageHeightMm - m, true);
  }
  for (const y of fromTopMm) {
    split(y, m, left, false);
    split(y, right, grid.pageWidthMm - m, false);
  }
  return marks;
}

/** Room a one-line sheet label needs across its baseline. */
const LABEL_SPACE_MM = 3.5;

/**
 * Where the sheet's label goes (§12.9): in the widest printable strip outside
 * the cards and their bleed, below them by preference. A side strip runs the
 * text bottom to top.
 */
export function apronSheetLabelPosition(grid: ApronSheetGrid): {
  xMm: number;
  yMm: number;
  angle: 0 | 90;
} {
  const b = APRON_BLEED_MM;
  const m = grid.marginMm;
  const gridBottom = grid.originYMm + grid.rows * grid.cardHeightMm;
  const below = grid.pageHeightMm - m - (gridBottom + b);
  const above = grid.originYMm - b - m;
  const beside = grid.originXMm - b - m;
  if (below >= LABEL_SPACE_MM) {
    return {
      xMm: grid.originXMm,
      yMm: grid.pageHeightMm - m - (below - LABEL_SPACE_MM) / 2 - 1,
      angle: 0,
    };
  }
  if (above >= LABEL_SPACE_MM || above >= beside) {
    return { xMm: grid.originXMm, yMm: m + Math.min(above, 3), angle: 0 };
  }
  return { xMm: m + Math.min(beside, 3), yMm: gridBottom, angle: 90 };
}

/** One print file's line on the order sheet (§12.10). */
export interface ApronOrderLine {
  size: ApronCardSize;
  sheets: number;
  cards: number;
  spares: number;
  cutsFromLeftIn: string[];
  cutsFromTopIn: string[];
}

export function apronOrderLine(
  size: ApronCardSize,
  grid: ApronSheetGrid,
  sheets: readonly ApronSheetSlot<unknown>[][]
): ApronOrderLine {
  const slots = sheets.flat();
  const spares = slots.filter((slot) => slot.spare).length;
  const { fromLeftMm, fromTopMm } = apronCutPositions(grid);
  const inches = (mm: number): string => (mm / 25.4).toFixed(2);
  return {
    size,
    sheets: sheets.length,
    cards: slots.length - spares,
    spares,
    cutsFromLeftIn: fromLeftMm.map(inches),
    cutsFromTopIn: fromTopMm.map(inches),
  };
}
