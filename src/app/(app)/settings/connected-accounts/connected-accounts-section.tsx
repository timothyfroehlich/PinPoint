import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { getLoginUrl } from "~/lib/login-url";
import { providers, type ProviderKey } from "~/lib/auth/providers";
import { canUnlinkIdentity } from "~/lib/auth/identity-guards";
import { ConnectedAccountRow } from "./connected-account-row";

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

  const { data: identitiesData } = await supabase.auth.getUserIdentities();
  const identities = identitiesData?.identities ?? [];

  const providerKeys = Object.keys(providers) as ProviderKey[];

  return (
    <div>
      <h2 className="text-balance text-xl font-semibold mb-4">
        Connected Accounts
      </h2>
      <p className="text-pretty text-sm text-muted-foreground mb-4">
        Link a third-party account to sign in faster. You can always remove one,
        but you must keep at least one way to sign in.
      </p>
      <div className="divide-y">
        {providerKeys.map((key) => {
          const isLinked = identities.some((i) => i.provider === key);
          const check = canUnlinkIdentity(identities, key);
          const canUnlink = check.ok;

          return (
            <ConnectedAccountRow
              key={key}
              providerKey={key}
              displayName={providers[key].displayName}
              isLinked={isLinked}
              canUnlink={canUnlink}
            />
          );
        })}
      </div>
    </div>
  );
}
