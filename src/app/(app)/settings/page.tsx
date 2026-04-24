import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { getLoginUrl } from "~/lib/url";
import { db } from "~/server/db";
import {
  userProfiles,
  notificationPreferences,
  machines,
} from "~/server/db/schema";
import { eq, and, ne, count, inArray } from "drizzle-orm";
import { isInternalAccount } from "~/lib/auth/internal-accounts";
import { ProfileForm } from "./profile-form";
import { ConnectedAccountsSection } from "./connected-accounts/connected-accounts-section";
import { NotificationPreferencesForm } from "./notifications/notification-preferences-form";
import { ChangePasswordSection } from "./change-password-section";
import { DeleteAccountSection } from "./delete-account-section";
import { Separator } from "~/components/ui/separator";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
export default async function SettingsPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(getLoginUrl("/settings"));
  }

  // Fetch user profile
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (!profile) {
    // Should not happen due to trigger, but handle gracefully
    redirect(getLoginUrl("/settings"));
  }

  // Fetch notification preferences
  let preferences = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, user.id),
  });

  // Create default preferences if they don't exist (fallback for old users)
  if (!preferences) {
    [preferences] = await db
      .insert(notificationPreferences)
      .values({ userId: user.id })
      .returning();
  }

  if (!preferences) {
    throw new Error("Failed to create notification preferences");
  }

  // Fetch owned machines count and potential reassignment targets
  const [ownedMachinesResult, membersResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(machines)
      .where(eq(machines.ownerId, user.id)),
    db
      .select({ id: userProfiles.id, name: userProfiles.name })
      .from(userProfiles)
      .where(
        and(
          ne(userProfiles.id, user.id),
          // Guests cannot own machines (matrix: machines.edit guest:false).
          // Only member+ are valid reassignment targets. (PP-hci)
          inArray(userProfiles.role, ["member", "technician", "admin"])
        )
      ),
  ]);

  const ownedMachineCount = ownedMachinesResult[0]?.count ?? 0;

  // Check if user is the sole admin
  const isSoleAdmin =
    profile.role === "admin" && // permissions-audit-allow: sole-admin invariant (business rule)
    (
      await db
        .select({ count: count() })
        .from(userProfiles)
        .where(
          and(eq(userProfiles.role, "admin"), ne(userProfiles.id, user.id))
        )
    )[0]?.count === 0;

  return (
    <PageContainer size="narrow">
      <PageHeader title="Settings" />

      <div className="space-y-6">
        <div>
          <h2 className="text-balance text-xl font-semibold mb-4">
            Profile Settings
          </h2>
          <ProfileForm
            firstName={profile.firstName}
            lastName={profile.lastName}
            email={profile.email}
            role={profile.role}
            isInternalAccount={isInternalAccount(profile.email)}
          />
        </div>

        <Separator />

        <div>
          <ConnectedAccountsSection />
        </div>

        <Separator />

        <div>
          <h2 className="text-balance text-xl font-semibold mb-4">
            Notification Preferences
          </h2>
          {/* CORE-SEC-006: Map to minimal shape, strip userId */}
          <NotificationPreferencesForm
            preferences={{
              emailEnabled: preferences.emailEnabled,
              inAppEnabled: preferences.inAppEnabled,
              suppressOwnActions: preferences.suppressOwnActions,
              emailNotifyOnAssigned: preferences.emailNotifyOnAssigned,
              inAppNotifyOnAssigned: preferences.inAppNotifyOnAssigned,
              emailNotifyOnStatusChange: preferences.emailNotifyOnStatusChange,
              inAppNotifyOnStatusChange: preferences.inAppNotifyOnStatusChange,
              emailNotifyOnNewComment: preferences.emailNotifyOnNewComment,
              inAppNotifyOnNewComment: preferences.inAppNotifyOnNewComment,
              emailNotifyOnMentioned: preferences.emailNotifyOnMentioned,
              inAppNotifyOnMentioned: preferences.inAppNotifyOnMentioned,
              emailNotifyOnNewIssue: preferences.emailNotifyOnNewIssue,
              inAppNotifyOnNewIssue: preferences.inAppNotifyOnNewIssue,
              emailWatchNewIssuesGlobal: preferences.emailWatchNewIssuesGlobal,
              inAppWatchNewIssuesGlobal: preferences.inAppWatchNewIssuesGlobal,
            }}
            isInternalAccount={isInternalAccount(profile.email)}
          />
        </div>

        <Separator />

        <div>
          <h2 className="text-balance text-xl font-semibold mb-4">Security</h2>
          <p className="text-pretty text-sm text-muted-foreground mb-4">
            Change your account password.
          </p>
          <ChangePasswordSection />
        </div>

        <Separator />

        <div>
          <h2 className="text-balance text-xl font-semibold mb-2 text-destructive">
            Danger Zone
          </h2>
          <p className="text-pretty text-sm text-muted-foreground mb-4">
            Permanently delete your account and anonymize your contributions.
          </p>
          <DeleteAccountSection
            ownedMachineCount={ownedMachineCount}
            members={membersResult}
            isSoleAdmin={isSoleAdmin}
          />
        </div>
      </div>
    </PageContainer>
  );
}
