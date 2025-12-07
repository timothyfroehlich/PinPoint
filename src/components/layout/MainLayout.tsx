import type React from "react";
import { Sidebar } from "./Sidebar";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  notifications,
  userProfiles,
  issues,
  machines,
} from "~/server/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import {
  NotificationList,
  type EnrichedNotification,
} from "~/components/notifications/NotificationList";
import { UserMenu } from "./user-menu-client";
import { ensureUserProfile } from "~/lib/auth/profile";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { MobileNav } from "./MobileNav";

export async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userNotifications: (typeof notifications.$inferSelect)[] = [];
  let enrichedNotifications: EnrichedNotification[] = [];
  let userProfile:
    | { name: string; role: "guest" | "member" | "admin" }
    | undefined;

  if (user) {
    userNotifications = await db.query.notifications.findMany({
      where: eq(notifications.userId, user.id),
      orderBy: [desc(notifications.createdAt)],
      limit: 20,
    });

    // Enrich notifications with links
    const issueIds = userNotifications
      .filter((n) => n.resourceType === "issue")
      .map((n) => n.resourceId);
    const machineIds = userNotifications
      .filter((n) => n.resourceType === "machine")
      .map((n) => n.resourceId);

    const issuesData =
      issueIds.length > 0
        ? await db.query.issues.findMany({
            where: inArray(issues.id, issueIds),
            columns: { id: true, machineInitials: true, issueNumber: true },
          })
        : [];

    const machinesData =
      machineIds.length > 0
        ? await db.query.machines.findMany({
            where: inArray(machines.id, machineIds),
            columns: { id: true, initials: true },
          })
        : [];

    enrichedNotifications = userNotifications.map((n) => {
      let link = "/dashboard";
      let machineInitials: string | undefined;
      let issueNumber: number | undefined;

      if (n.resourceType === "issue") {
        const issue = issuesData.find((i) => i.id === n.resourceId);
        if (issue) {
          link = `/m/${issue.machineInitials}/i/${issue.issueNumber}`;
          machineInitials = issue.machineInitials;
          issueNumber = issue.issueNumber;
        }
      } else {
        // If not an issue, it must be a machine based on resourceType enum
        const machine = machinesData.find((m) => m.id === n.resourceId);
        if (machine) link = `/m/${machine.initials}`;
      }
      // Ensure all properties of EnrichedNotification are present
      return { ...n, link, machineInitials, issueNumber };
    });

    userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { name: true, role: true },
    });

    if (!userProfile) {
      // Auto-heal profile if missing (e.g. after DB reset)
      await ensureUserProfile(user);

      // Refetch profile after healing
      userProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { name: true, role: true },
      });
    }
  }

  return (
    <div className="flex h-full bg-background text-foreground">
      {/* Sidebar - Hidden on mobile */}
      <aside className="hidden md:block h-full">
        <Sidebar role={userProfile?.role} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header Area */}
        <header className="flex h-16 items-center justify-between border-b border-border px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          {/* Mobile Menu Trigger */}
          <div className="md:hidden mr-4">
            <MobileNav role={userProfile?.role} />
          </div>

          {/* Dynamic Header Area - Title removed to allow content to breathe */}
          <div className="flex-1" />

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Button
                  asChild
                  variant="default"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  <Link href="/report">Report Issue</Link>
                </Button>
                <NotificationList notifications={enrichedNotifications} />
                <UserMenu userName={userProfile?.name ?? "User"} />
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:bg-primary/10"
                  data-testid="nav-report-issue"
                >
                  <Link href="/report">Report Issue</Link>
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="nav-signin"
                >
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild size="sm" data-testid="nav-signup">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </header>

        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
