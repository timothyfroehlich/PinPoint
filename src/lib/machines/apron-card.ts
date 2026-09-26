import { docToPlainText, type ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  getCurrentManufacturer,
  type MachineManufacturerSource,
} from "~/lib/machines/manufacturer";
import { formatCreditNames, type MachineCredits } from "~/lib/opdb/credits";

export const APRON_CARD_SIZES = {
  stern: {
    label: "Stern / SPIKE",
    dimensions: "140 × 75 mm",
    widthMm: 140,
    heightMm: 75,
  },
  wpc: {
    label: "WPC",
    dimensions: "6 × 3.25 in",
    widthMm: 152.4,
    heightMm: 82.55,
  },
} as const;

export type ApronCardSize = keyof typeof APRON_CARD_SIZES;

export interface ApronCardContent {
  name: string;
  edition: string | null;
  manufacturer: string | null;
  year: number | null;
  ownerName: string | null;
  description: string;
  tip: string;
  tipEnabled: boolean;
  credits: MachineCredits;
  designEnabled: boolean;
  artEnabled: boolean;
}

interface ApronMachineSource extends MachineManufacturerSource {
  name: string;
  year: number | null;
  description: ProseMirrorDoc | null;
  apronUseCustomDescription: boolean;
  apronDescription: string | null;
  apronTip: string | null;
  apronTipEnabled: boolean;
  apronDesignEnabled: boolean;
  apronArtEnabled: boolean;
  owner: { name: string } | null;
  pinballmapTitle: {
    name: string;
    machineGroupId: number | null;
    groupName: string | null;
    manufacturer: string | null;
  } | null;
}

/** Only grouped Pinball Map families supply edition metadata. */
export function groupedEdition(
  title: Pick<
    NonNullable<ApronMachineSource["pinballmapTitle"]>,
    "name" | "machineGroupId" | "groupName"
  > | null
): string | null {
  if (title?.machineGroupId === null || !title?.groupName) return null;
  if (!title.name.startsWith(`${title.groupName} `)) return null;

  const suffix = title.name
    .slice(title.groupName.length)
    .trim()
    .replaceAll(/[()]/g, "")
    .trim();
  if (!suffix) return null;

  const mapped = suffix
    .replaceAll(/\bLE\b/g, "Limited")
    .replaceAll(/\bCE\b/g, "Collector's")
    .replaceAll(/\bSE\b/g, "Special");
  return /\bedition$/i.test(mapped) ? mapped : `${mapped} Edition`;
}

export function apronCardContent(
  machine: ApronMachineSource,
  credits: MachineCredits
): ApronCardContent {
  return {
    name: machine.name,
    edition: groupedEdition(machine.pinballmapTitle),
    // The same manufacturer the machine page and its tag show (spec 8.5).
    manufacturer: getCurrentManufacturer(machine),
    year: machine.year,
    ownerName: machine.owner?.name ?? null,
    description: machine.apronUseCustomDescription
      ? (machine.apronDescription ?? "")
      : docToPlainText(machine.description),
    tip: machine.apronTip ?? "",
    tipEnabled: machine.apronTipEnabled,
    credits,
    designEnabled: machine.apronDesignEnabled,
    artEnabled: machine.apronArtEnabled,
  };
}

/** Names a credit row shows before collapsing the rest into a count (10.3). */
export const APRON_CREDIT_MAX_NAMES = 2;

export interface ApronCreditRow {
  label: "Design" | "Art";
  /** The names, or "Unknown" when the role has none (spec 10.4). */
  text: string;
}

/** The identity panel's credit rows, Design then Art, for enabled roles. */
export function apronCreditRows(
  content: Pick<ApronCardContent, "credits" | "designEnabled" | "artEnabled">
): ApronCreditRow[] {
  const rows: ApronCreditRow[] = [];
  const row = (label: ApronCreditRow["label"], names: string[]): void => {
    rows.push({
      label,
      text: formatCreditNames(names, APRON_CREDIT_MAX_NAMES) ?? "Unknown",
    });
  };
  if (content.designEnabled) row("Design", content.credits.design);
  if (content.artEnabled) row("Art", content.credits.art);
  return rows;
}

/**
 * Card-face geometry per apron size, in CSS px (1px = 1/96in, so the face
 * prints at its physical size). Values come from the approved design canvas
 * (PP-esta, Claude Design artifact 2dbc7ba6): Stern/SPIKE is 529×283 with a
 * 206px identity panel; WPC is 576×312 with a 244px panel. The QR shrinks
 * when a tip is shown so the description region keeps its room, and the logo
 * shrinks while credit rows show so the identity panel keeps its room (10.6).
 */
export interface ApronCardLayout {
  width: string;
  height: string;
  panelWidth: number;
  /** The panel's inner width — the room the title fits into. */
  titleMaxWidth: number;
  panelPadding: string;
  bodyPadding: string;
  titleMaxPx: number;
  titleMinPx: number;
  logoWidth: number;
  logoWithCreditsWidth: number;
  qrPx: number;
  qrWithTipPx: number;
  bodyFontPx: number;
}

export const APRON_CARD_LAYOUTS: Record<ApronCardSize, ApronCardLayout> = {
  stern: {
    width: "140mm",
    height: "75mm",
    panelWidth: 206,
    titleMaxWidth: 174,
    panelPadding: "16px 16px 12px 16px",
    bodyPadding: "16px 16px 14px 16px",
    titleMaxPx: 42,
    titleMinPx: 24,
    logoWidth: 140,
    logoWithCreditsWidth: 96,
    qrPx: 100,
    qrWithTipPx: 84,
    bodyFontPx: 12,
  },
  wpc: {
    width: "6in",
    height: "3.25in",
    panelWidth: 244,
    titleMaxWidth: 208,
    panelPadding: "18px 18px 14px 18px",
    bodyPadding: "18px 18px 16px 18px",
    titleMaxPx: 46,
    titleMinPx: 26,
    logoWidth: 160,
    logoWithCreditsWidth: 110,
    qrPx: 108,
    qrWithTipPx: 92,
    bodyFontPx: 12.5,
  },
};

export const APRON_TITLE_MAX_LINES = 3;

/**
 * White space the print sheet adds around the card on each side, in mm: a 3mm
 * gap past the 2mm panel bleed, then 5mm crop marks.
 */
export const APRON_SHEET_MARGIN_MM = 8;

/** Width of `text` rendered in the title face at `fontPx`. */
export type MeasureText = (text: string, fontPx: number) => number;

/** Lines a greedy word wrap needs for `words` within `maxWidth`. */
function greedyLineCount(
  words: string[],
  fontPx: number,
  maxWidth: number,
  measure: MeasureText
): number {
  const space = measure(" ", fontPx);
  let lines = 1;
  let lineWidth = 0;
  for (const word of words) {
    const wordWidth = measure(word, fontPx);
    if (lineWidth === 0) {
      lineWidth = wordWidth;
    } else if (lineWidth + space + wordWidth <= maxWidth) {
      lineWidth += space + wordWidth;
    } else {
      lines += 1;
      lineWidth = wordWidth;
    }
  }
  return lines;
}

/**
 * Title fit (spec §1): shrink from the maximum until the longest word fits on
 * one line, then until the whole title wraps to at most three lines. Stops at
 * the floor even if the title still needs more lines; never breaks a word.
 */
export function fitTitleSize({
  title,
  maxWidth,
  maxPx,
  minPx,
  measure,
  maxLines = APRON_TITLE_MAX_LINES,
}: {
  title: string;
  maxWidth: number;
  maxPx: number;
  minPx: number;
  measure: MeasureText;
  maxLines?: number;
}): number {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return maxPx;
  const STEP = 0.5;
  for (let size = maxPx; size > minPx; size -= STEP) {
    const widest = Math.max(...words.map((w) => measure(w, size)));
    if (
      widest <= maxWidth &&
      greedyLineCount(words, size, maxWidth, measure) <= maxLines
    ) {
      return size;
    }
  }
  return minPx;
}

/**
 * Title fit's last step (spec §1, 6.3): from the three-line fit, keep
 * shrinking until the identity panel fits above the APC logo. `fits` measures
 * the rendered panel at a size. Stops at the floor even if it still does not
 * fit.
 */
export function shrinkUntilFits({
  startPx,
  minPx,
  fits,
}: {
  startPx: number;
  minPx: number;
  fits: (px: number) => boolean;
}): number {
  const STEP = 0.5;
  let size = startPx;
  while (size > minPx && !fits(size)) {
    size = Math.max(minPx, size - STEP);
  }
  return size;
}

/** Splits card text into paragraphs on blank or single line breaks. */
export function cardParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}
/** A size's physical dimensions in CSS px (96 per inch). */
export function apronCardPixelSize(size: ApronCardSize): {
  width: number;
  height: number;
} {
  const { widthMm, heightMm } = APRON_CARD_SIZES[size];
  return { width: (widthMm / 25.4) * 96, height: (heightMm / 25.4) * 96 };
}
