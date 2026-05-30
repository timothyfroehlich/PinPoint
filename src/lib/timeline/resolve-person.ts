/**
 * Live person resolution for timeline events (PP-tv9l).
 *
 * Timeline person-references (`timeline_event_people`) store stable ids only.
 * This resolver turns a reference + its joined name columns into a display
 * value at render time, so names/invited-status always reflect current
 * reality instead of a frozen snapshot.
 *
 * There is no public user-profile route in PinPoint today, so resolution does
 * not produce links — only a display name and an invited flag. If a profile
 * page is added later, this is the single place to add an `href`.
 *
 * Never surfaces emails (CORE-SEC-007) — callers join only the generated
 * `name` columns.
 */

export interface PersonResolverInput {
  /** Real-user FK value; nulled by `onDelete set null` when the user is deleted. */
  userId: string | null;
  /** Invited-user FK value; rewritten to null at signup conversion. */
  invitedId: string | null;
  /** Joined `user_profiles.name` (present iff `userId` resolves to a live row). */
  userName: string | null;
  /** Joined `invited_users.name` (present iff `invitedId` resolves to a live row). */
  invitedName: string | null;
}

export interface ResolvedPerson {
  displayName: string;
  isInvited: boolean;
}

/**
 * Suffix appended to a resolved person's name to mark them as an invited
 * (not-yet-signed-up) account. Single source of truth so every renderer
 * agrees on wording and whitespace.
 */
export function personSuffix(person: ResolvedPerson): string {
  return person.isInvited ? " (invited)" : "";
}

/**
 * Full display label: `displayName` + the invited suffix when applicable.
 * Use this when name + suffix render as one flat string. When the name and
 * suffix need separate styling (bold name, regular suffix), call
 * `personSuffix` alongside `person.displayName` instead.
 */
export function personLabel(person: ResolvedPerson): string {
  return `${person.displayName}${personSuffix(person)}`;
}

/**
 * Resolve a person-reference to its current display value.
 *
 * - Real user → current name.
 * - Invited (not yet signed up) → current invited name, flagged invited.
 * - Both null (the real user was deleted, FK set null) → "Former user".
 */
export function resolvePerson(input: PersonResolverInput): ResolvedPerson {
  if (input.userId !== null) {
    return { displayName: input.userName ?? "Unknown user", isInvited: false };
  }
  if (input.invitedId !== null) {
    return {
      displayName: input.invitedName ?? "Invited user",
      isInvited: true,
    };
  }
  // Neither id present: the referenced real user was deleted and the FK was
  // nulled. The historical fact (a person acted here) survives; the identity
  // resolves to a privacy-safe placeholder.
  return { displayName: "Former user", isInvited: false };
}
