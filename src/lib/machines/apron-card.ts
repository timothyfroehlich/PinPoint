import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  cardTextBlocks,
  type CardTextBlock,
} from "~/lib/machines/apron-card-text";
import {
  getCurrentManufacturer,
  type MachineManufacturerSource,
} from "~/lib/machines/manufacturer";
import { formatCreditNames, type MachineCredits } from "~/lib/opdb/credits";

/**
 * Apron sizes (spec §1). A size takes its card-face geometry from the design
 * tuned for its width — 5.5in cards from Stern's, 6in cards from WPC's — so
 * its height only changes how much room the text gets. The 3in-tall Gottlieb
 * EM card is the exception: WPC's widths with Stern's vertical sizes, since
 * WPC's larger title floor and logo leave a long title no room at that height.
 * The 7×5in Glass corner card keeps WPC's geometry with Stern's narrower
 * identity panel, giving its extra room to the text.
 */
export const APRON_CARD_SIZES = {
  stern: {
    label: "Stern / Data East / Sega",
    dimensions: "140 × 75 mm",
    widthMm: 140,
    heightMm: 75,
    geometry: "narrow",
  },
  wpc: {
    label: "Williams / WPC",
    dimensions: "6 × 3.25 in",
    widthMm: 152.4,
    heightMm: 82.55,
    geometry: "wide",
  },
  bally: {
    label: "Bally solid state",
    dimensions: "5.5 × 3.25 in",
    widthMm: 139.7,
    heightMm: 82.55,
    geometry: "narrow",
  },
  "williams-em": {
    label: "Williams EM",
    dimensions: "6 × 3.5 in",
    widthMm: 152.4,
    heightMm: 88.9,
    geometry: "wide",
  },
  "gottlieb-em": {
    label: "Gottlieb EM",
    dimensions: "6 × 3 in",
    widthMm: 152.4,
    heightMm: 76.2,
    geometry: "short",
  },
  "bally-em": {
    label: "Bally EM",
    dimensions: "5.5 × 3.75 in",
    widthMm: 139.7,
    heightMm: 95.25,
    geometry: "narrow",
  },
  "glass-corner": {
    label: "Glass corner",
    dimensions: "7 × 5 in",
    widthMm: 177.8,
    heightMm: 127,
    geometry: "glass",
  },
} as const;

export type ApronCardSize = keyof typeof APRON_CARD_SIZES;

export function isApronCardSize(value: string): value is ApronCardSize {
  return Object.hasOwn(APRON_CARD_SIZES, value);
}

/** Which tuned card-face design a size draws its geometry from. */
export type ApronCardGeometry =
  (typeof APRON_CARD_SIZES)[ApronCardSize]["geometry"];

type SizedLayout<T> = T & { width: string; height: string };

/** A geometry's layout given a size's physical width and height. */
function layoutsBySize<T>(
  byGeometry: Record<ApronCardGeometry, T>
): Record<ApronCardSize, SizedLayout<T>> {
  const at = (size: ApronCardSize): SizedLayout<T> => {
    const { widthMm, heightMm, geometry } = APRON_CARD_SIZES[size];
    return {
      ...byGeometry[geometry],
      width: `${widthMm}mm`,
      height: `${heightMm}mm`,
    };
  };
  return {
    stern: at("stern"),
    wpc: at("wpc"),
    bally: at("bally"),
    "williams-em": at("williams-em"),
    "gottlieb-em": at("gottlieb-em"),
    "bally-em": at("bally-em"),
    "glass-corner": at("glass-corner"),
  };
}

/**
 * Card templates (spec §1, §5.5–5.7): which layout a card face uses. Side
 * rail and Header band give the description and tip more room than Standard
 * and show no credits (§10.2).
 */
export const APRON_CARD_TEMPLATES = {
  standard: { label: "Standard" },
  "side-rail": { label: "Side rail" },
  "header-band": { label: "Header band" },
} as const;

export type ApronCardTemplate = keyof typeof APRON_CARD_TEMPLATES;

export function isApronCardTemplate(value: string): value is ApronCardTemplate {
  return Object.hasOwn(APRON_CARD_TEMPLATES, value);
}

export interface ApronCardContent {
  name: string;
  edition: string | null;
  manufacturer: string | null;
  year: number | null;
  ownerName: string | null;
  /** The printable card text (spec §3.7). */
  description: CardTextBlock[];
  tip: CardTextBlock[];
  tipEnabled: boolean;
  credits: MachineCredits;
  designEnabled: boolean;
  artEnabled: boolean;
  /** Whether the machine has PinTips, which adds the playing tips row (5.4). */
  hasPinTips: boolean;
}

export interface ApronMachineSource extends MachineManufacturerSource {
  name: string;
  year: number | null;
  description: ProseMirrorDoc | null;
  owner: { name: string } | null;
  invitedOwner: { name: string } | null;
  pinballmapTitle: {
    name: string;
    machineGroupId: number | null;
    groupName: string | null;
    manufacturer: string | null;
  } | null;
}

/** The card settings a saved card carries (spec §11). */
export interface ApronCardSettings {
  template: ApronCardTemplate;
  useCustomDescription: boolean;
  description: ProseMirrorDoc | null;
  tip: ProseMirrorDoc | null;
  tipEnabled: boolean;
  designEnabled: boolean;
  artEnabled: boolean;
}

/** A machine's saved card as the Apron card tab reads it (spec §11). */
export interface SavedApronCard extends ApronCardSettings {
  id: string;
  name: string;
  size: ApronCardSize;
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

/** Identity lines and credits — everything on a card but its settings. */
export type ApronCardIdentity = Omit<
  ApronCardContent,
  "description" | "tip" | "tipEnabled" | "designEnabled" | "artEnabled"
>;

export function apronCardIdentity(
  machine: ApronMachineSource,
  credits: MachineCredits,
  hasPinTips: boolean
): ApronCardIdentity {
  return {
    name: machine.name,
    edition: groupedEdition(machine.pinballmapTitle),
    // The same manufacturer the machine page and its tag show (spec 8.5).
    manufacturer: getCurrentManufacturer(machine),
    year: machine.year,
    // A machine is owned by a registered user (`owner`) or by an invited
    // member who has not signed up yet (`invitedOwner`); the schema keeps them
    // mutually exclusive. The card prints the owner's name in either case —
    // the "(invited)" status marker the in-app owner block shows is an
    // internal-workflow detail, not something the physical card carries.
    ownerName: machine.owner?.name ?? machine.invitedOwner?.name ?? null,
    credits,
    hasPinTips,
  };
}

/**
 * What a card prints for its settings (spec §2.2, §3.7): the card description
 * when chosen, else the machine's main description. One function for the
 * Apron card tab's preview and for print and export, so they never disagree.
 */
export function cardFaceContent(
  identity: ApronCardIdentity,
  mainDescription: ProseMirrorDoc | null,
  card: ApronCardSettings | null
): ApronCardContent {
  return {
    ...identity,
    description: cardTextBlocks(
      card?.useCustomDescription ? card.description : mainDescription
    ),
    tip: cardTextBlocks(card?.tip),
    tipEnabled: card?.tipEnabled ?? false,
    designEnabled: card?.designEnabled ?? true,
    artEnabled: card?.artEnabled ?? true,
  };
}

export function apronCardContent(
  machine: ApronMachineSource,
  card: ApronCardSettings | null,
  credits: MachineCredits,
  hasPinTips: boolean
): ApronCardContent {
  return cardFaceContent(
    apronCardIdentity(machine, credits, hasPinTips),
    machine.description,
    card
  );
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
 * (PP-esta, Claude Design artifact 2dbc7ba6): the narrow geometry is Stern's
 * 529×283 card with a 206px identity panel; the wide one is WPC's 576×312
 * card with a 244px panel. The QR shrinks
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

/** A layout before a size supplies its physical width and height. */
type ApronGeometryLayout = Omit<ApronCardLayout, "width" | "height">;

export const APRON_CARD_LAYOUTS = layoutsBySize<ApronGeometryLayout>({
  narrow: {
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
  wide: {
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
  short: {
    panelWidth: 244,
    titleMaxWidth: 212,
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
  glass: {
    panelWidth: 206,
    titleMaxWidth: 170,
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
});

/**
 * Side rail geometry (spec §5.6; canvas NLAnYXFFC4j3748otKxoPq, option A): a
 * narrower panel with no credits, so the logo and QR keep one size each.
 */
export const APRON_SIDE_RAIL_LAYOUTS = layoutsBySize<ApronGeometryLayout>({
  narrow: {
    panelWidth: 160,
    titleMaxWidth: 132,
    panelPadding: "14px 14px 12px 14px",
    bodyPadding: "14px 16px 12px 16px",
    titleMaxPx: 32,
    titleMinPx: 16,
    logoWidth: 88,
    logoWithCreditsWidth: 88,
    qrPx: 98,
    qrWithTipPx: 98,
    bodyFontPx: 12,
  },
  wide: {
    panelWidth: 184,
    titleMaxWidth: 152,
    panelPadding: "16px 16px 12px 16px",
    bodyPadding: "18px 18px 14px 18px",
    titleMaxPx: 34,
    titleMinPx: 17,
    logoWidth: 96,
    logoWithCreditsWidth: 96,
    qrPx: 108,
    qrWithTipPx: 108,
    bodyFontPx: 12.5,
  },
  short: {
    panelWidth: 184,
    titleMaxWidth: 156,
    panelPadding: "14px 14px 12px 14px",
    bodyPadding: "14px 16px 12px 16px",
    titleMaxPx: 32,
    titleMinPx: 16,
    logoWidth: 88,
    logoWithCreditsWidth: 88,
    qrPx: 98,
    qrWithTipPx: 98,
    bodyFontPx: 12,
  },
  glass: {
    panelWidth: 160,
    titleMaxWidth: 128,
    panelPadding: "16px 16px 12px 16px",
    bodyPadding: "18px 18px 14px 18px",
    titleMaxPx: 34,
    titleMinPx: 17,
    logoWidth: 96,
    logoWithCreditsWidth: 96,
    qrPx: 108,
    qrWithTipPx: 108,
    bodyFontPx: 12.5,
  },
});

/**
 * Header band geometry (spec §5.7, §6.5; canvas option B). The band has a
 * fixed height; its title fits the room left of the logo in at most two
 * lines, then shrinks until the band's content fits.
 */
export interface ApronHeaderBandLayout {
  width: string;
  height: string;
  bandHeight: number;
  bandPadding: string;
  /** The band's width less its padding, the logo, and the gap before it. */
  titleMaxWidth: number;
  titleMaxPx: number;
  titleMinPx: number;
  logoWidth: number;
  qrPx: number;
  bodyPadding: string;
  bodyFontPx: number;
}

export const APRON_HEADER_BAND_LAYOUTS = layoutsBySize<
  Omit<ApronHeaderBandLayout, "width" | "height">
>({
  narrow: {
    bandHeight: 66,
    bandPadding: "10px 14px 10px 16px",
    titleMaxWidth: 425,
    titleMaxPx: 28,
    titleMinPx: 15,
    logoWidth: 62,
    qrPx: 98,
    bodyPadding: "12px 16px 12px 16px",
    bodyFontPx: 12,
  },
  wide: {
    bandHeight: 72,
    bandPadding: "11px 16px 11px 18px",
    titleMaxWidth: 462,
    titleMaxPx: 30,
    titleMinPx: 16,
    logoWidth: 68,
    qrPx: 108,
    bodyPadding: "14px 18px 14px 18px",
    bodyFontPx: 12.5,
  },
  short: {
    bandHeight: 66,
    bandPadding: "10px 14px 10px 16px",
    titleMaxWidth: 472,
    titleMaxPx: 28,
    titleMinPx: 15,
    logoWidth: 62,
    qrPx: 98,
    bodyPadding: "12px 16px 12px 16px",
    bodyFontPx: 12,
  },
  glass: {
    bandHeight: 72,
    bandPadding: "11px 16px 11px 18px",
    titleMaxWidth: 558,
    titleMaxPx: 30,
    titleMinPx: 16,
    logoWidth: 68,
    qrPx: 108,
    bodyPadding: "14px 18px 14px 18px",
    bodyFontPx: 12.5,
  },
});

export const APRON_TITLE_MAX_LINES = 3;

/** The Header band title's line limit, in place of three (spec §6.5). */
export const APRON_BAND_TITLE_MAX_LINES = 2;

/** What the title fit needs from a template's layout at one size. */
export interface ApronTitleFit {
  titleMaxWidth: number;
  titleMaxPx: number;
  titleMinPx: number;
  maxLines: number;
}

export function apronTitleFit(
  template: ApronCardTemplate,
  size: ApronCardSize
): ApronTitleFit {
  if (template === "header-band") {
    return {
      ...APRON_HEADER_BAND_LAYOUTS[size],
      maxLines: APRON_BAND_TITLE_MAX_LINES,
    };
  }
  const layout =
    template === "side-rail"
      ? APRON_SIDE_RAIL_LAYOUTS[size]
      : APRON_CARD_LAYOUTS[size];
  return { ...layout, maxLines: APRON_TITLE_MAX_LINES };
}

/**
 * White space the print sheet adds around the card on each side, in mm: a 3mm
 * gap past the 2mm panel bleed, then 5mm crop marks.
 */
export const APRON_SHEET_MARGIN_MM = 8;

/** Width of `text` rendered in the title face at `fontPx`. */
export type MeasureText = (text: string, fontPx: number) => number;

/**
 * One word of a title and what joins it to the word before: a space, or
 * nothing when the break point is a hyphen or an ellipsis.
 */
export interface TitleWord {
  text: string;
  joiner: " " | "";
}

/**
 * Splits a title at its line-break points (spec §1): spaces, and after each
 * hyphen or ellipsis. "LIGHTS...CAMERA...ACTION!" is three words and
 * "HARLEY-DAVIDSON" two; neither is ever broken anywhere else.
 */
export function titleWords(title: string): TitleWord[] {
  const words: TitleWord[] = [];
  for (const spaced of title.split(/\s+/).filter(Boolean)) {
    spaced.split(/(?<=-|\.\.\.|…)(?=\S)/).forEach((text, i) => {
      words.push({ text, joiner: i === 0 && words.length > 0 ? " " : "" });
    });
  }
  return words;
}

/** Lines a greedy word wrap needs for `words` within `maxWidth`. */
function greedyLineCount(
  words: TitleWord[],
  fontPx: number,
  maxWidth: number,
  measure: MeasureText
): number {
  const space = measure(" ", fontPx);
  let lines = 1;
  let lineWidth = 0;
  for (const word of words) {
    const wordWidth = measure(word.text, fontPx);
    const gap = word.joiner === " " ? space : 0;
    if (lineWidth === 0) {
      lineWidth = wordWidth;
    } else if (lineWidth + gap + wordWidth <= maxWidth) {
      lineWidth += gap + wordWidth;
    } else {
      lines += 1;
      lineWidth = wordWidth;
    }
  }
  return lines;
}

/**
 * Title fit (spec §1): shrink from the maximum until the longest word fits on
 * one line, then until the whole title wraps to at most three lines. Words
 * end at spaces, hyphens, and ellipses (titleWords). Stops at the floor even
 * if the title still needs more lines; never breaks a word.
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
  const words = titleWords(title);
  if (words.length === 0) return maxPx;
  const STEP = 0.5;
  for (let size = maxPx; size > minPx; size -= STEP) {
    const widest = Math.max(...words.map((w) => measure(w.text, size)));
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

/** A size's physical dimensions in CSS px (96 per inch). */
export function apronCardPixelSize(size: ApronCardSize): {
  width: number;
  height: number;
} {
  const { widthMm, heightMm } = APRON_CARD_SIZES[size];
  return { width: (widthMm / 25.4) * 96, height: (heightMm / 25.4) * 96 };
}
