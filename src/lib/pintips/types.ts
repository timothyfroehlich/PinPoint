/**
 * PinTips — Match Play Events' crowd-sourced playing tips, one list per OPDB
 * game (group). PinPoint keeps a copy of Match Play's daily export and reads
 * only that copy. Spec: docs/feature-specs/pintips.md.
 */

/**
 * The categories PinPoint shows, in PinTips' own lower-case vocabulary.
 * PinTips' `illegal` category is deliberately absent: it is a moderation flag,
 * and those tips are never stored or shown (spec 2.6).
 */
export const PINTIP_CATEGORIES = [
  "general",
  "multiball",
  "skillshot",
  "wizard",
  "secret",
] as const;
export type PinTipCategory = (typeof PINTIP_CATEGORIES)[number];

/** Display names for the categories (spec 3.4). */
export const PINTIP_CATEGORY_LABELS: Record<PinTipCategory, string> = {
  general: "General",
  multiball: "Multiball",
  skillshot: "Skill shot",
  wizard: "Wizard",
  secret: "Secret",
};

/** One tip from the export, reduced to what PinPoint keeps. */
export interface PinTip {
  /** PinTips' own stable id. */
  tipId: number;
  /** The OPDB game (group) id the tip belongs to, e.g. `GweeP`. */
  opdbGroupId: string;
  category: PinTipCategory;
  voteTotal: number;
  text: string;
}

/** The fields the tip card renders and weights by. */
export type PinTipForCard = Pick<
  PinTip,
  "tipId" | "category" | "voteTotal" | "text"
>;
