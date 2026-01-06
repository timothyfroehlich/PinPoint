import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles, notificationPreferences } from "~/server/db/schema";
import { eq } from "drizzle-orm";
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
    redirect("/login?next=%2Fsettings");
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
            role={profile.role}
          />
        </div>

        <Separator />

        <div>
          <h2 className="text-xl font-semibold mb-4">
            Notification Preferences
          </h2>
          <NotificationPreferencesForm preferences={preferences} />
        </div>
      </div>
    </div>
  );
}
