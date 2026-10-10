/**
 * Design, art, and code credits for a machine, taken from its stored OPDB record
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
  /**
   * Programmers, in OPDB's display order — OPDB's `software` role. Empty when
   * OPDB lists none, which is every EM and most games before the DMD era.
   */
  code: string[];
}

export const NO_CREDITS: MachineCredits = { design: [], art: [], code: [] };

function namesForRole(people: readonly OpdbPerson[], role: string): string[] {
  const names = people
    .filter((p) => p.role === role)
    .toSorted((a, b) => a.index - b.index)
    .map((p) => p.name.trim())
    .filter((name) => name !== "");
  return [...new Set(names)];
}

/** Design, art, and code names from an OPDB record's people, in OPDB's order. */
export function creditsFromPeople(
  people: readonly OpdbPerson[]
): MachineCredits {
  return {
    design: namesForRole(people, "design"),
    art: namesForRole(people, "art"),
    code: namesForRole(people, "software"),
  };
}

/**
 * An uncataloged machine's hand-entered designers, artists, and programmers
 * (pinballmap spec 2.4, apron-cards 10.1), cleaned the way OPDB names are:
 * trimmed, blanks dropped, duplicates removed, entry order kept.
 */
export function creditsFromNames(
  designers: readonly string[] | null,
  artists: readonly string[] | null,
  programmers: readonly string[] | null
): MachineCredits {
  const clean = (names: readonly string[] | null): string[] => [
    ...new Set(
      (names ?? []).map((name) => name.trim()).filter((name) => name !== "")
    ),
  ];
  return {
    design: clean(designers),
    art: clean(artists),
    code: clean(programmers),
  };
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
