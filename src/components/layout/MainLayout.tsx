import type React from "react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  notifications,
  userProfiles,
  issues,
  machines,
} from "~/server/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { type EnrichedNotification } from "~/components/notifications/NotificationList";
import { ensureUserProfile } from "~/lib/auth/profile";
import { AppHeader } from "./AppHeader";
import { BottomTabBar } from "./BottomTabBar";
import changelogMeta from "@content/changelog-meta.json";
import { getLastIssuesPath, getChangelogSeen } from "~/lib/cookies/preferences";

export async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  // Read user preferences from cookies (server-side)
  const [issuesPath, changelogSeen] = await Promise.all([
    getLastIssuesPath(),
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
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Unified AppHeader — always rendered, adapts at md: breakpoint */}
      <AppHeader
        isAuthenticated={!!user}
        userName={userProfile?.name ?? "User"}
        role={userProfile?.role}
        notifications={enrichedNotifications}
        issuesPath={issuesPath}
        newChangelogCount={newChangelogCount}
      />

      {/* Main Content */}
      {/* scroll-pt-14: reserves space for the 56px sticky AppHeader so
          browser scroll-into-view doesn't place interactive elements under it. */}
      <main className="flex-1 overflow-y-auto scroll-pt-14">
        {/* Extra bottom padding on mobile so content isn't hidden behind the fixed tab bar */}
        <div className="@container px-4 sm:px-8 lg:px-10 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </main>

      {/* Fixed bottom tab bar — mobile only (md:hidden is applied inside the component) */}
      <BottomTabBar role={userProfile?.role} issuesPath={issuesPath} />
    </div>
  );
}
