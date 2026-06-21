import type React from "react";
import { isInternalAccount } from "~/lib/auth/internal-accounts";

/**
 * Read-only display of the signed-in user's email in the Authentication
 * section. CORE-SEC-007 permits showing the owner their own email on their
 * own settings page (the email is not editable — it is the auth identity).
 *
 * Admin-created username accounts carry a synthetic `@pinpoint.internal`
 * address that we never surface; they see a "username account" note instead.
 */
export function AccountEmail({ email }: { email: string }): React.JSX.Element {
  const internal = isInternalAccount(email);
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Email</p>
      {internal ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="account-email-none"
        >
          Username account — no email on file.
        </p>
      ) : (
        <p className="text-sm text-foreground" data-testid="account-email">
          {email}
        </p>
      )}
    </div>
  );
}
