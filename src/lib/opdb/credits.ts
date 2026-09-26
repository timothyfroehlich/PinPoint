/**
 * Design and art credits for a machine, taken from its stored OPDB record
 * (PP-tv2u). Shown on the Info tab's Details card and on the apron card
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
