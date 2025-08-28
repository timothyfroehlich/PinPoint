import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { AlertTriangleIcon, PlusIcon, ArrowRightIcon } from "lucide-react";
import { requireAuthContext } from "~/lib/dal/shared";
import { getIssuesForOrg } from "~/lib/dal/issues";
import {
  getOrganizationById,
  getOrganizationStats,
} from "~/lib/dal/organizations";
import { IssuesListServer } from "~/components/issues/issues-list-server";
import { DashboardStats } from "~/components/dashboard/dashboard-stats";
import { QuickActions } from "~/components/dashboard/quick-actions";

export async function generateMetadata() {
  const { organizationId } = await requireAuthContext();
  const organization = await getOrganizationById(organizationId);

  return {
    title: `Dashboard - ${organization.name}`,
    description: `Issue management dashboard for ${organization.name}`,
  };
}

export default async function DashboardPage() {
  // Authentication validation with automatic redirect
  const { user, organizationId } = await requireAuthContext();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back,{" "}
            {user.user_metadata?.["name"] ??
              user.email?.split("@")[0] ??
              "User"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <Suspense fallback={<OrgNameSkeleton />}>
              <OrganizationName organizationId={organizationId} />
            </Suspense>
          </div>
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.user_metadata?.["profile_picture"]} />
            <AvatarFallback>
              {user.user_metadata?.["name"]
                ?.split(" ")
                .map((n: string) => n[0])
                .join("") ||
                user.email?.[0]?.toUpperCase() ||
                "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Organization Statistics */}
      <Suspense fallback={<StatsLoadingSkeleton />}>
        <DashboardStatsWithData organizationId={organizationId} />
      </Suspense>

      {/* Quick Actions */}
      <QuickActions />

      {/* Recent Issues */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Recent Issues</h2>
          <Button variant="outline" asChild>
            <Link href="/issues">
              View All Issues
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>

        <Suspense fallback={<RecentIssuesLoadingSkeleton />}>
          <RecentIssuesWithData organizationId={organizationId} />
        </Suspense>
      </div>
    </div>
  );
}

// Server Component for organization name
async function OrganizationName({
  organizationId,
}: {
  organizationId: string;
}) {
  const organization = await getOrganizationById(organizationId);
  return (
    <div className="text-sm text-muted-foreground">{organization.name}</div>
  );
}

// Server Component for dashboard statistics
async function DashboardStatsWithData({
  organizationId,
}: {
  organizationId: string;
}) {
  const stats = await getOrganizationStats();

  // Transform to match DashboardStats component interface
  const dashboardStats = {
    totalIssues: stats.issues.total,
    openIssues: stats.issues.new,
    closedIssues: stats.issues.resolved,
    totalMachines: stats.machines.total,
    inProgressIssues: stats.issues.inProgress,
  };

  return <DashboardStats stats={dashboardStats} />;
}

// Server Component for recent issues
async function RecentIssuesWithData({
  organizationId,
}: {
  organizationId: string;
}) {
  const issues = await getIssuesForOrg();
  const recentIssues = issues.slice(0, 5);

  if (recentIssues.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangleIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No issues yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by creating your first issue report.
          </p>
          <Button asChild className="mt-4">
            <Link href="/issues/create">
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Issue
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <IssuesListServer issues={recentIssues} limit={5} />

      {issues.length > 5 && (
        <div className="text-center pt-4">
          <p className="text-sm text-muted-foreground">
            Showing 5 of {issues.length} total issues
          </p>
        </div>
      )}
    </div>
  );
}

// Loading Skeletons
function OrgNameSkeleton() {
  return <div className="h-4 bg-muted rounded w-24 animate-pulse" />;
}

function StatsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="h-4 bg-muted rounded w-20 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-8 bg-muted rounded w-12 animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentIssuesLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
