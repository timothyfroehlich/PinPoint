import type React from "react";
import { Sidebar } from "./Sidebar";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { notifications, userProfiles } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { NotificationList } from "~/components/notifications/NotificationList";
import { UserMenu } from "./user-menu-client";

export async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userNotifications: (typeof notifications.$inferSelect)[] = [];
  let userProfile: { name: string } | undefined;

  if (user) {
    userNotifications = await db.query.notifications.findMany({
      where: eq(notifications.userId, user.id),
      orderBy: [desc(notifications.createdAt)],
      limit: 20,
    });

    userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { name: true },
    });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar - Hidden on mobile for MVP (or we can add a simple toggle later) */}
      <aside className="hidden md:block">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header Area */}
        <header className="flex h-16 items-center justify-between border-b border-border px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>

          <div className="flex items-center gap-4">
            {user && (
              <>
                <NotificationList notifications={userNotifications} />
                <UserMenu
                  userName={userProfile?.name ?? "User"}
                  userEmail={user.email ?? ""}
                />
              </>
            )}
          </div>
        </header>

        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
