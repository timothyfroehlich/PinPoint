import type React from "react";
import { db } from "~/server/db";
import { notifications, issues, machines } from "~/server/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { type EnrichedNotification } from "~/components/notifications/NotificationList";
import { getHealedViewer } from "~/lib/auth/viewer";
import { AppHeader } from "./AppHeader";
import { BottomTabBar } from "./BottomTabBar";
import changelogMeta from "@content/changelog-meta.json";
import { getChangelogSeen } from "~/lib/cookies/preferences";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import {
  reportModePath,
  resolveDefaultReportMode,
} from "~/lib/report/default-mode";
import { LIST_PAGER_SLOT_ID } from "~/components/list-view/pager-slot";
import { QuickSearchProvider } from "./QuickSearch";

export async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  // Read user preferences from cookies (server-side)
  const changelogSeen = await getChangelogSeen();

  // Compute unread changelog count from metadata file
  const newChangelogCount = Math.max(
    0,
    changelogMeta.totalEntries - changelogSeen
  );

  // Shares the request's getUser() and profile read with the page
  // (getViewer), and heals a missing profile row.
  const { userId, profile: userProfile } = await getHealedViewer();

  let enrichedNotifications: EnrichedNotification[] = [];

  if (userId) {
    const userNotifications = await db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
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
        if (machine) {
          // A Pinball Map comment lands on the machine's timeline.
          link =
            n.type === "pinballmap_comment"
              ? `/m/${machine.initials}/timeline`
              : `/m/${machine.initials}`;
          machineInitials = machine.initials;
        }
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
  }

  const canMultiple =
    Boolean(userId) &&
    checkPermission("issues.report.quick", getAccessLevel(userProfile?.role));
  const mobileReportHref = reportModePath(
    resolveDefaultReportMode(
      userProfile?.mobileReportMode ?? "quick",
      canMultiple,
      "quick"
    )
  );
  const desktopReportHref = reportModePath(
    resolveDefaultReportMode(
      userProfile?.desktopReportMode ?? "detailed",
      canMultiple,
      "detailed"
    )
  );

  return (
    <QuickSearchProvider>
      <div className="flex h-full flex-col bg-background text-foreground">
        {/* Unified AppHeader — always rendered, adapts at md: breakpoint */}
        <AppHeader
          isAuthenticated={!!userId}
          userName={userProfile?.name ?? "User"}
          role={userProfile?.role}
          userId={userId}
          notifications={enrichedNotifications}
          newChangelogCount={newChangelogCount}
          reportHref={desktopReportHref}
        />

        {/* Main Content */}
        {/* scroll-pt-14: reserves space for the 56px sticky AppHeader so
            browser scroll-into-view doesn't place interactive elements under it.
            Mobile scroll-pb: the same for the fixed bottom tab bar, plus a
            floating action's clearance when a page shows one (WCAG 2.4.11;
            globals.css defines it).
            relative: <main> is the scroller, so it must also be the containing
            block for absolutely positioned content (sr-only live regions
            included). Otherwise that content overflows the document, which
            then scrolls the app header away. */}
        <main
          id="main-content"
          tabIndex={-1}
          className="relative flex-1 overflow-y-auto scroll-pt-14 max-md:scroll-pb-[calc(56px+env(safe-area-inset-bottom)+8px+var(--floating-action-clearance,0px))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {/* Extra bottom padding on mobile so content isn't hidden behind the fixed tab bar */}
          <div className="@container px-4 sm:px-8 lg:px-10 pb-[calc(88px+env(safe-area-inset-bottom))] [&:has([data-machine-scan-hub])]:pb-0 md:pb-0">
            {children}
          </div>
          {/* A List View's phone pager renders here, outside the size
              container above (list-views §7.8; see LIST_PAGER_SLOT_ID). */}
          <div id={LIST_PAGER_SLOT_ID} />
        </main>

        {/* Fixed bottom tab bar — mobile only (md:hidden is applied inside the component) */}
        <BottomTabBar role={userProfile?.role} reportHref={mobileReportHref} />
      </div>
    </QuickSearchProvider>
  );
}
