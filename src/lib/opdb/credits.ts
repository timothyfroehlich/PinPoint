/**
 * Design and art credits for a machine, taken from its stored OPDB record
 * (PP-tv2u), or for an uncataloged machine from its hand-entered lists
 * (PP-wqit.14). Shown on the Info tab's Details card and on the apron card
 * (spec apron-cards §10).
 */
import type { OpdbPerson } from "./types";

export interface MachineCredits {
  /** Designers, in OPDB's display order. Empty when OPDB lists none. */
  design: string[];
  /** Artists, in OPDB's display order. Empty when OPDB lists none. */
  art: string[];
}

export const NO_CREDITS: MachineCredits = { design: [], art: [] };

function namesForRole(people: readonly OpdbPerson[], role: string): string[] {
  const names = people
    .filter((p) => p.role === role)
    .toSorted((a, b) => a.index - b.index)
    .map((p) => p.name.trim())
    .filter((name) => name !== "");
  return [...new Set(names)];
}

/** Design and art names from an OPDB record's people, in OPDB's order. */
export function creditsFromPeople(
  people: readonly OpdbPerson[]
): MachineCredits {
  return {
    design: namesForRole(people, "design"),
    art: namesForRole(people, "art"),
  };
}

/**
 * An uncataloged machine's hand-entered designers and artists (pinballmap
 * spec 2.4, apron-cards 10.1), cleaned the way OPDB names are: trimmed, blanks
 * dropped, duplicates removed, entry order kept.
 */
export function creditsFromNames(
  designers: readonly string[] | null,
  artists: readonly string[] | null
): MachineCredits {
  const clean = (names: readonly string[] | null): string[] => [
    ...new Set(
      (names ?? []).map((name) => name.trim()).filter((name) => name !== "")
    ),
  ];
  return { design: clean(designers), art: clean(artists) };
}

/**
 * One role's names as a single line: comma-joined, or `null` when there are
 * none. With `max`, names past the first `max` collapse into a count
 * ("Kevin O'Connor, Dave Link +3 more"), the apron card's limit (spec 10.3).
 */
export function formatCreditNames(
  names: readonly string[],
  max?: number
): string | null {
  if (names.length === 0) return null;
  if (max === undefined || names.length <= max) return names.join(", ");
  const rest = names.length - max;
  return `${names.slice(0, max).join(", ")} +${String(rest)} more`;
}
