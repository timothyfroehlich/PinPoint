/**
 * Activity Log Settings Page
 * Server Component with audit trail, filtering, and pagination
 * Phase 4B.4: Activity Log
 */

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  ActivityIcon,
  ClockIcon,
  UserIcon,
  FileTextIcon,
  ShieldIcon,
  AlertTriangleIcon,
  SettingsIcon,
  DownloadIcon,
  FilterIcon,
} from "lucide-react";
import { getRequestAuthContext } from "~/server/auth/context";
import { AuthGuard } from "~/components/auth/auth-guard";
import { getActivityLog, getActivityStats } from "~/lib/dal/activity-log";
import { ActivityLogFilter } from "./components/ActivityLogFilter";
import { format } from "date-fns";

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const authContext = await getRequestAuthContext();

  return (
    <AuthGuard
      authContext={authContext}
      fallbackTitle="Activity Log Access Required"
      fallbackMessage="You need to be signed in as a member to view activity logs."
    >
      <ActivityLogPageContent searchParams={searchParams} />
    </AuthGuard>
  );
}

async function ActivityLogPageContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    throw new Error("Unauthorized access"); // This should never happen due to AuthGuard
  }
  const organizationId = authContext.org.id;

  // Await searchParams as required by Next.js 15
  const resolvedSearchParams = await searchParams;

  // Parse search parameters for filtering
  const page = parseInt((resolvedSearchParams["page"] as string) || "1", 10);
  const limit = parseInt((resolvedSearchParams["limit"] as string) || "50", 10);
  const userId = resolvedSearchParams["userId"] as string;
  const action = resolvedSearchParams["action"] as string;
  const dateFrom = resolvedSearchParams["dateFrom"] as string;
  const dateTo = resolvedSearchParams["dateTo"] as string;

  // Fetch activity log data from database
  const [activityResult, stats] = await Promise.all([
    getActivityLog(organizationId, {
      page,
      limit,
      userId,
      action,
      dateFrom,
      dateTo,
    }),
    getActivityStats(organizationId),
  ]);

  const {
    entries: mockActivityLog,
    totalCount: totalEntries,
    totalPages,
  } = activityResult;

  const getActionIcon = (
    action: string,
  ): React.ComponentType<{ className?: string }> => {
    switch (action) {
      case "USER_LOGIN":
      case "USER_LOGOUT":
        return UserIcon;
      case "ISSUE_CREATED":
      case "ISSUE_UPDATED":
        return FileTextIcon;
      case "ROLE_CHANGED":
        return ShieldIcon;
      case "SETTINGS_UPDATED":
        return SettingsIcon;
      default:
        return ActivityIcon;
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case "error":
        return "text-on-error-container bg-error-container";
      case "warning":
        return "text-on-secondary-container bg-secondary-container";
      default:
        return "text-on-primary-container bg-primary-container";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity Log</h1>
          <p className="text-muted-foreground">
            View and audit all system activity and user actions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/admin/export/activity-log" download>
              <DownloadIcon className="mr-2 h-4 w-4" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      {/* Activity Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Actions</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.userActions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Security Events
            </CardTitle>
            <ShieldIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.securityEvents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-error">
              {stats.errorEvents}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FilterIcon className="h-5 w-5" />
            <span>Filter Activity</span>
          </CardTitle>
          <CardDescription>
            Filter activity log entries by date, user, or action type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityLogFilter />
        </CardContent>
      </Card>

      {/* Activity Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
          <CardDescription>
            Detailed log of all system activity and user actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockActivityLog.map((entry) => {
              const ActionIcon = getActionIcon(entry.action);

              return (
                <div
                  key={entry.id}
                  className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Icon and Severity */}
                  <div
                    className={`p-2 rounded-lg ${getSeverityColor(entry.severity)}`}
                  >
                    <ActionIcon className="h-4 w-4" />
                  </div>

                  {/* Activity Details */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium">{entry.details}</h3>
                        <Badge variant="outline" className="text-xs">
                          {entry.action.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <ClockIcon className="h-3 w-3" />
                        {format(entry.created_at, "PPp")}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <UserIcon className="h-3 w-3" />
                        <span>{entry.userName}</span>
                        <span>({entry.userEmail})</span>
                      </div>
                      <span>•</span>
                      <span>IP: {entry.ip_address}</span>
                      <span>•</span>
                      <span>Entity: {entry.entity_type}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} to{" "}
              {Math.min(page * limit, totalEntries)} of {totalEntries} entries
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" disabled={page <= 1}>
                Previous
              </Button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="sm"
                      className="w-8"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" disabled={page >= totalPages}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
