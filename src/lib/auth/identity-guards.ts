import type { UserIdentity } from "@supabase/supabase-js";
import type { ProviderKey } from "~/lib/auth/providers";

export type UnlinkCheck =
  | { ok: true; identity: UserIdentity }
  | { ok: false; reason: "ONLY_IDENTITY" | "NOT_LINKED" };

/**
 * Decides whether `providerKey` can safely be unlinked from the current user.
 *
 * Safety invariant (spec decision #8): every user must retain ≥1 identity
 * after an unlink. A user with only a Discord identity cannot unlink Discord;
 * they must first add a password or another OAuth provider.
 *
 * This function is pure so it can be unit-tested without a Supabase client
 * and reused from both the server action and the Server Component that
 * decides whether to render the unlink button as disabled.
 */
export function canUnlinkIdentity(
  identities: readonly UserIdentity[],
  providerKey: ProviderKey
): UnlinkCheck {
  const match = identities.find((i) => i.provider === providerKey);

  if (!match) {
    return { ok: false, reason: "NOT_LINKED" };
  }

  if (identities.length <= 1) {
    return { ok: false, reason: "ONLY_IDENTITY" };
  }

  return { ok: true, identity: match };
}
