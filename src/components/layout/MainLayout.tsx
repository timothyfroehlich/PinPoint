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
import { MobileHeader } from "./MobileHeader";
import { FeedbackWidget } from "~/components/feedback/FeedbackWidget";
import { BottomTabBar } from "./BottomTabBar";
import changelogMeta from "@content/changelog-meta.json";
import { HeaderSignInButton } from "./header-sign-in-button";
import {
  getLastIssuesPath,
  getSidebarCollapsed,
  getChangelogSeen,
} from "~/lib/cookies/preferences";

export async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  // Read user preferences from cookies (server-side)
  const [issuesPath, sidebarCollapsed, changelogSeen] = await Promise.all([
    getLastIssuesPath(),
    getSidebarCollapsed(),
    getChangelogSeen(),
  ]);

  // Compute unread changelog count from metadata file
  const newChangelogCount = Math.max(
    0,
    changelogMeta.totalEntries - changelogSeen
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let enrichedNotifications: EnrichedNotification[] = [];
  let userProfile:
    | { name: string; role: "guest" | "member" | "technician" | "admin" }
    | undefined;

  if (user) {
    const userNotifications = await db.query.notifications.findMany({
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

    // CORE-SEC-006: Map to minimal shape before passing to client component
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
      return {
        id: n.id,
        type: n.type,
        createdAt: n.createdAt,
        link,
        machineInitials,
        issueNumber,
      };
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
      {/* Sidebar - Desktop only */}
      <aside className="hidden md:block h-full">
        <Sidebar
          role={userProfile?.role}
          issuesPath={issuesPath}
          initialCollapsed={sidebarCollapsed}
          newChangelogCount={newChangelogCount}
        />
      </aside>

      {/* Main Content */}
      {/* scroll-pt-[52px]: reserves space for the 52px sticky mobile header so
          browser scroll-into-view doesn't place interactive elements under it. */}
      <main className="flex-1 overflow-y-auto scroll-pt-[52px] md:scroll-pt-0">
        {/* Mobile Header — compact sticky header (md:hidden) */}
        {user ? (
          <MobileHeader
            isAuthenticated={true}
            userName={userProfile?.name ?? "User"}
            notifications={enrichedNotifications}
          />
        ) : (
          <MobileHeader isAuthenticated={false} />
        )}

        {/* Desktop Header — hidden on mobile */}
        <header className="hidden md:flex h-16 items-center justify-between border-b border-border px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          {/* Left spacer */}
          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <FeedbackWidget />
            <Button
              asChild
              variant="ghost"
              size="sm"
              data-testid="nav-report-issue"
            >
              <Link href="/report">Report Issue</Link>
            </Button>

            {user ? (
              <div className="flex items-center gap-4">
                <NotificationList notifications={enrichedNotifications} />
                <UserMenu userName={userProfile?.name ?? "User"} />
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-4 w-px bg-border mx-1 hidden lg:block" />
                <HeaderSignInButton />
                <Button asChild size="sm" data-testid="nav-signup">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Extra bottom padding on mobile so content isn't hidden behind the fixed tab bar */}
        <div className="px-4 sm:px-8 lg:px-10 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </main>

      {/* Fixed bottom tab bar — mobile only (md:hidden is applied inside the component) */}
      <BottomTabBar role={userProfile?.role} issuesPath={issuesPath} />
    </div>
  );
}
