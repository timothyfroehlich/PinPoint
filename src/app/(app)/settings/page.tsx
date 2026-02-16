import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles, notificationPreferences } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { isInternalAccount } from "~/lib/auth/internal-accounts";
import { ProfileForm } from "./profile-form";
import { NotificationPreferencesForm } from "./notifications/notification-preferences-form";
import { Separator } from "~/components/ui/separator";

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fsettings");
  }

  // Fetch user profile
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (!profile) {
    // Should not happen due to trigger, but handle gracefully
    redirect("/login");
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

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile and application preferences.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>
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
          <h2 className="text-xl font-semibold mb-4">
            Notification Preferences
          </h2>
          {/* CORE-SEC-006: Map to minimal shape, strip userId */}
          <NotificationPreferencesForm
            preferences={{
              emailEnabled: preferences.emailEnabled,
              inAppEnabled: preferences.inAppEnabled,
              emailNotifyOnAssigned: preferences.emailNotifyOnAssigned,
              inAppNotifyOnAssigned: preferences.inAppNotifyOnAssigned,
              emailNotifyOnStatusChange: preferences.emailNotifyOnStatusChange,
              inAppNotifyOnStatusChange: preferences.inAppNotifyOnStatusChange,
              emailNotifyOnNewComment: preferences.emailNotifyOnNewComment,
              inAppNotifyOnNewComment: preferences.inAppNotifyOnNewComment,
              emailNotifyOnNewIssue: preferences.emailNotifyOnNewIssue,
              inAppNotifyOnNewIssue: preferences.inAppNotifyOnNewIssue,
              emailWatchNewIssuesGlobal: preferences.emailWatchNewIssuesGlobal,
              inAppWatchNewIssuesGlobal: preferences.inAppWatchNewIssuesGlobal,
            }}
            isInternalAccount={isInternalAccount(profile.email)}
          />
        </div>
      </div>
    </div>
  );
}
