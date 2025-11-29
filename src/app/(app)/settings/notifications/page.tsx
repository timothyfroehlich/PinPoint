import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { notificationPreferences } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { NotificationPreferencesForm } from "./notification-preferences-form";
import { PageShell } from "~/components/layout/PageShell";

export default async function NotificationPreferencesPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch preferences or create default
  let preferences = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, user.id),
  });

  if (!preferences) {
    // Create default preferences if not found
    [preferences] = await db
      .insert(notificationPreferences)
      .values({ userId: user.id })
      .returning();
  }

  if (!preferences) {
    throw new Error("Failed to load preferences");
  }

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        <NotificationPreferencesForm preferences={preferences} />
      </div>
    </PageShell>
  );
}
