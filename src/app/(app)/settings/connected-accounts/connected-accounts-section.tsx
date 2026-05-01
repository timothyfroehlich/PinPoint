import type React from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { log } from "~/lib/logger";
import { getLoginUrl } from "~/lib/login-url";
import { providers, type ProviderKey } from "~/lib/auth/providers";
import { canUnlinkIdentity } from "~/lib/auth/identity-guards";
import { isDiscordIntegrationEnabled } from "~/lib/discord/config";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { ConnectedAccountRow } from "./connected-account-row";
import { DiscordTestDmButton } from "./discord-test-dm-button";

/**
 * Renders one row per registered provider showing connected/disconnected state.
 * Entirely server-rendered — the row component only becomes "use client" to
 * host the unlink-disabled tooltip; all link/unlink logic is in server actions.
 */
export async function ConnectedAccountsSection(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(getLoginUrl("/settings"));
  }

  const { data: identitiesData, error: identitiesError } =
    await supabase.auth.getUserIdentities();

  const header = (
    <>
      <h2 className="text-balance text-xl font-semibold mb-4">
        Connected Accounts
      </h2>
      <p className="text-pretty text-sm text-muted-foreground mb-4">
        Link a third-party account to sign in faster and receive notifications
        on that platform. You can always remove one, but you must keep at least
        one way to sign in.
      </p>
    </>
  );

  if (identitiesError) {
    log.error(
      { userId: user.id, err: identitiesError.message },
      "Failed to load connected account identities"
    );
    return (
      <div>
        {header}
        <p className="text-sm text-destructive">
          We couldn&apos;t load your connected accounts right now. Please
          refresh the page and try again.
        </p>
      </div>
    );
  }

  const identities = identitiesData.identities;

  // Only show providers whose env vars are configured; a button for an
  // unconfigured provider would always fail at redirect time.
  const visibleKeys = (Object.keys(providers) as ProviderKey[]).filter((key) =>
    providers[key].isAvailable()
  );

  // Test DM is only meaningful when the bot integration is wired up. Only
  // need the boolean — skip the Vault decrypt that getDiscordConfig() does.
  const discordIntegrationEnabled = await isDiscordIntegrationEnabled();

  // The test-DM button needs to know whether THIS user can receive DMs, which
  // is gated on the mirror column (`user_profiles.discord_user_id`) — that's
  // what the dispatcher actually reads at delivery time. The Connect/Disconnect
  // UI uses `auth.identities` (the sign-in capability check); these can diverge
  // briefly during link/unlink, and the runtime cares about delivery readiness,
  // not sign-in.
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { discordUserId: true },
  });
  const canReceiveDiscordDms = profile?.discordUserId != null;

  if (visibleKeys.length === 0) {
    return (
      <div>
        {header}
        <p className="text-sm text-muted-foreground">
          No providers configured.
        </p>
      </div>
    );
  }

  return (
    <div id="connected-accounts">
      {header}
      <div className="divide-y">
        {visibleKeys.map((key) => {
          const isLinked = identities.some((i) => i.provider === key);
          const check = canUnlinkIdentity(identities, key);
          const canUnlink = check.ok;
          const showTestDm =
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- ProviderKey narrows to "discord" today; load-bearing once Google etc. land.
            key === "discord" &&
            canReceiveDiscordDms &&
            discordIntegrationEnabled;

          return (
            <ConnectedAccountRow
              key={key}
              providerKey={key}
              displayName={providers[key].displayName}
              isLinked={isLinked}
              canUnlink={canUnlink}
              secondaryAction={showTestDm ? <DiscordTestDmButton /> : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
