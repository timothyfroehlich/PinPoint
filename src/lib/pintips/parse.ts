/**
 * Defensive parser from the PinTips export JSON into {@link PinTip} rows.
 *
 * Match Play is a third party we do not control, so every field is narrowed
 * rather than trusted. A malformed entry, an entry in the `illegal` category,
 * and an entry in a category PinPoint has no name for are all skipped.
 */
import { PINTIP_CATEGORIES, type PinTip, type PinTipCategory } from "./types";

/** An OPDB game (group) id: `G` then alphanumerics, no machine or alias part. */
const OPDB_GROUP_ID_PATTERN = /^G[a-zA-Z0-9]+$/;

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asCategory(v: unknown): PinTipCategory | null {
  return PINTIP_CATEGORIES.find((c) => c === v) ?? null;
}

/** One export entry, or null when PinPoint cannot or must not show it. */
export function parsePinTip(raw: unknown): PinTip | null {
  const r = asRecord(raw);
  if (!r) return null;
  const tipId = r["tipId"];
  const opdbGroupId = r["opdbId"];
  const voteTotal = r["voteTotal"];
  const text = typeof r["text"] === "string" ? r["text"].trim() : "";
  const category = asCategory(r["category"]);
  if (
    typeof tipId !== "number" ||
    !Number.isSafeInteger(tipId) ||
    typeof opdbGroupId !== "string" ||
    !OPDB_GROUP_ID_PATTERN.test(opdbGroupId) ||
    typeof voteTotal !== "number" ||
    !Number.isSafeInteger(voteTotal) ||
    text === "" ||
    category === null
  ) {
    return null;
  }
  return { tipId, opdbGroupId, category, voteTotal, text };
}

/** The export is a JSON array of tips; anything else parses to no tips. */
export function parsePinTipsExport(raw: unknown): PinTip[] {
  if (!Array.isArray(raw)) return [];
  const tips: PinTip[] = [];
  const seen = new Set<number>();
  for (const entry of raw) {
    const tip = parsePinTip(entry);
    if (tip && !seen.has(tip.tipId)) {
      seen.add(tip.tipId);
      tips.push(tip);
    }
  }
  return tips;
}

/**
 * The OPDB game (group) id of any OPDB id: `GweeP-Ml9pZ-ARZoY` → `GweeP`.
 * PinTips keeps one list per game, so every edition of a title shares it
 * (spec §1 "Game").
 */
export function opdbGroupId(opdbId: string): string | null {
  const group = opdbId.split("-")[0] ?? "";
  return OPDB_GROUP_ID_PATTERN.test(group) ? group : null;
}

/** The game's PinTips page on Match Play (spec 3.1). */
export function pinTipsPageUrl(groupId: string): string {
  return `https://app.matchplay.events/opdb/entries/${encodeURIComponent(groupId)}/pintips`;
}
