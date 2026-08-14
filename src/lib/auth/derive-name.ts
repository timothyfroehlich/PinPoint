/**
 * Deriving a usable name for a new account (PP-if48).
 *
 * Signing up with email puts `first_name` / `last_name` straight into the auth
 * metadata, because our own signup form collected them. **OAuth providers send
 * neither key.** Discord sends the account handle as `full_name` ("pmuntner"),
 * the handle-with-discriminator as `name` ("pmuntner#0"), and the human display
 * name — the only field that tends to hold a real name — nested under
 * `custom_claims.global_name` ("Paul Muntner").
 *
 * Before this module both writers of `user_profiles` read `first_name` /
 * `last_name` and defaulted to `''`, so every OAuth-only signup landed with a
 * blank name. That is not a cosmetic problem: `user_profiles.name` is a
 * generated column, so a blank user's name was a single space — non-null, which
 * meant every `?? "Anonymous"` fallback in the app stepped straight over it, and
 * every owner/assignee picker (which filters on `name`) could only match him by
 * typing a literal space. An APC member went un-assignable for two weeks that
 * way.
 *
 * The two callers that must agree here are this module and the
 * `handle_new_user` SQL trigger. Keep the order below identical to
 * `derive_profile_name()` in `drizzle/0064_last_cannonball.sql`; a divergence
 * shows up as a user whose name depends on whether the trigger or the auto-heal
 * path ran first. `scripts/sql/verify-derive-name.sql` asserts the two agree,
 * over the same cases as `derive-name.test.ts`.
 */

/** Auth metadata as the provider hands it to us — untyped by construction. */
export type AuthMetadata = Record<string, unknown>;

export interface DerivedName {
  firstName: string;
  lastName: string;
  /**
   * `false` only when the user actually typed the name (our signup form or an
   * admin invite). `true` when we fell back to a provider handle or the email
   * local-part, which means the name is a placeholder.
   *
   * Nothing persists this yet. It exists because the follow-up that asks such a
   * user to confirm their name needs to tell a placeholder from a real name,
   * and that is recoverable after the fact — `raw_user_meta_data` is still on
   * the `auth.users` row, so re-running this function answers it without a
   * column to backfill.
   */
  derived: boolean;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Split a single display string into first + last on the FIRST whitespace run,
 * so "Paul Muntner" splits but "Mary Anne van der Berg" keeps everything after
 * "Mary" together as the surname. A single-token name yields an empty last
 * name, which is legal — only the first name is required.
 */
function splitDisplayName(display: string): { first: string; last: string } {
  const parts = display.split(/\s+/u).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

/**
 * Discord's `name` carries a legacy discriminator ("pmuntner#0"). Nothing else
 * uses `#`, so stripping a trailing `#<digits>` is safe and keeps the fallback
 * from producing a name with a stray number glued on.
 */
function stripDiscriminator(handle: string): string {
  return handle.replace(/#\d+$/u, "").trim();
}

/**
 * Best available name for a new profile, and whether the user chose it.
 *
 * Never returns an empty first name, for any input at all — the email local-part
 * is the floor, and `"Member"` is the floor under that. The guarantee has to be
 * unconditional: it is what lets the DB enforce `btrim(first_name) <> ''`
 * without the check being able to fail a signup or an auto-heal.
 */
export function deriveName(
  metadata: AuthMetadata | null | undefined,
  email: string
): DerivedName {
  const meta = metadata ?? {};

  // 1. The user typed it (email signup, or an accepted invite).
  const explicitFirst = str(meta["first_name"]);
  const explicitLast = str(meta["last_name"]);
  if (explicitFirst) {
    return {
      firstName: explicitFirst,
      lastName: explicitLast,
      derived: false,
    };
  }

  // 2. Discord's human-facing display name — the one field that usually holds
  //    a real name. Nested, so it needs an object guard before the index.
  const claims = meta["custom_claims"];
  const globalName =
    typeof claims === "object" && claims !== null
      ? str((claims as AuthMetadata)["global_name"])
      : "";

  // 3. then the provider's full name, 4. then the handle-with-discriminator.
  const candidate =
    globalName ||
    str(meta["full_name"]) ||
    stripDiscriminator(str(meta["name"]));

  if (candidate) {
    const { first, last } = splitDisplayName(candidate);
    if (first) return { firstName: first, lastName: last, derived: true };
  }

  // 5. Floor: the email local-part, then a literal. The local-part is non-empty
  //    for any real address, but `"@x.com"` and `""` are strings this function
  //    accepts, and returning `""` for them would push a
  //    `user_profiles_first_name_not_blank` violation into the auto-heal path —
  //    turning a cosmetic problem into a failed sign-in. `derive_profile_name()`
  //    falls back to the same literal; keep them identical.
  const localPart = email.split("@")[0]?.trim() ?? "";
  return { firstName: localPart || "Member", lastName: "", derived: true };
}
