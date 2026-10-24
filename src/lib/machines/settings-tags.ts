/**
 * Settings tag pages (docs/feature-specs/machine-settings.md §3.6–§3.7):
 * shapes and pure helpers shared by the Settings tags page, a tag's page, and
 * their queries. Client-safe.
 */

import {
  BUILTIN_SETTINGS_TAGS,
  type SettingsPreferredSlot,
} from "~/lib/machines/settings-types";
import {
  serializeSheetDefault,
  type SheetDefault,
} from "~/lib/machines/settings-sheet-run";

/** A settings tag with how many sets carry it (§3.7). */
export interface SettingsTagSummary {
  id: string;
  slug: string;
  name: string;
  isBuiltin: boolean;
  setCount: number;
  machineCount: number;
}

/** One set carrying the tag, as its tag page lists it (§3.6). */
export interface SettingsTagPageSet {
  id: string;
  name: string;
  isCommunity: boolean;
  isPreferredHouse: boolean;
  isPreferredTournament: boolean;
  /** ISO timestamp of the last edit. */
  updatedAt: string;
}

export interface SettingsTagPageMachine {
  id: string;
  initials: string;
  name: string;
  onTheFloor: boolean;
  sets: SettingsTagPageSet[];
}

export interface SettingsTagPage {
  id: string;
  slug: string;
  name: string;
  isBuiltin: boolean;
  machines: SettingsTagPageMachine[];
}

/** The slot a built-in tag fills, or null for a tag people made. */
export function builtinSlotOf(slug: string): SettingsPreferredSlot | null {
  return BUILTIN_SETTINGS_TAGS.find((slot) => slot === slug) ?? null;
}

/** House, Tournament, then the other tags by name (§3.7). */
export function compareSettingsTags(
  a: { slug: string; name: string },
  b: { slug: string; name: string }
): number {
  const rank = (slug: string): number => {
    const slot = builtinSlotOf(slug);
    return slot === null
      ? BUILTIN_SETTINGS_TAGS.length
      : BUILTIN_SETTINGS_TAGS.indexOf(slot);
  };
  return rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name);
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** "8 sets on 7 machines", or "No sets". */
export function setsOnMachinesPhrase(
  setCount: number,
  machineCount: number
): string {
  if (setCount === 0) return "No sets";
  return `${plural(setCount, "set", "sets")} on ${plural(machineCount, "machine", "machines")}`;
}

/**
 * The default-set slot a tag's print link resolves against. A built-in tag
 * names its own default set; any other tag is the To side, which settles a
 * machine's several tagged sets with its default Tournament set
 * (settings-sheets §6.2).
 */
function printSlotOf(slug: string): SettingsPreferredSlot {
  return builtinSlotOf(slug) ?? "tournament";
}

/**
 * How many of a machine's tagged sets the print run would ask about: the
 * count when there are two or more and none is the default set for the tag's
 * side (settings-sheets §6.3), else 0.
 */
export function undecidedSetCount(
  slug: string,
  sets: readonly Pick<
    SettingsTagPageSet,
    "isPreferredHouse" | "isPreferredTournament"
  >[]
): number {
  if (sets.length < 2) return 0;
  const slot = printSlotOf(slug);
  const settled = sets.some((set) =>
    slot === "house" ? set.isPreferredHouse : set.isPreferredTournament
  );
  return settled ? 0 : sets.length;
}

/**
 * Print settings sheets with the tagged machines On the Floor added and the
 * tag as the To starting set (settings-sheets §2.6). A built-in tag starts
 * from its default set.
 */
export function settingsTagPrintHref(
  slug: string,
  machines: readonly Pick<SettingsTagPageMachine, "initials" | "onTheFloor">[]
): string {
  const slot = builtinSlotOf(slug);
  const to: SheetDefault =
    slot === null ? { kind: "tag", slug } : { kind: slot };
  const params = new URLSearchParams({
    to: serializeSheetDefault(to),
    m: machines
      .filter((machine) => machine.onTheFloor)
      .map((machine) => machine.initials)
      .join(","),
  });
  return `/m/settings-sheets?${params.toString()}`;
}

export function settingsTagHref(slug: string): string {
  return `/c/settings-tags/${encodeURIComponent(slug)}`;
}

export const SETTINGS_TAGS_HREF = "/c/settings-tags";

/** Sets and machines on a tag's page (§3.6). */
export function settingsTagPageCounts(
  page: Pick<SettingsTagPage, "machines">
): {
  setCount: number;
  machineCount: number;
} {
  return {
    setCount: page.machines.reduce((sum, m) => sum + m.sets.length, 0),
    machineCount: page.machines.length,
  };
}
