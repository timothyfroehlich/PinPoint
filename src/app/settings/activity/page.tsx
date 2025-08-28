/**
 * Activity Log Settings Page
 * Server Component with audit trail, filtering, and pagination
 * Phase 4B.4: Activity Log
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { 
  ActivityIcon, 
  ClockIcon,
  UserIcon,
  FileTextIcon,
  ShieldIcon,
  AlertTriangleIcon,
  SettingsIcon,
  DownloadIcon,
  FilterIcon
} from "lucide-react";
import { requireAuthContext } from "~/lib/dal/shared";
import { ActivityLogFilter } from "./components/ActivityLogFilter";
import { format, subDays } from "date-fns";

interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  userName: string;
  userEmail: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  severity: "info" | "warning" | "error";
}

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { organizationId } = await requireAuthContext();

  // Parse search parameters for filtering
  const page = parseInt((searchParams.page as string) || "1", 10);
  const limit = parseInt((searchParams.limit as string) || "50", 10);
  const userId = searchParams.userId as string;
  const action = searchParams.action as string;
  const dateFrom = searchParams.dateFrom as string;
  const dateTo = searchParams.dateTo as string;

  // TODO: Fetch activity log data from database
  // This would normally come from a DAL function or tRPC query
  const mockActivityLog: ActivityLogEntry[] = [
    {
      id: "activity-1",
      timestamp: new Date(),
      action: "USER_LOGIN",
      entity: "USER", 
      entityId: "user-123",
      userId: "user-123",
      userName: "John Doe",
      userEmail: "john@example.com",
      details: "User logged in successfully",
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      severity: "info"
    },
    {
      id: "activity-2",
      timestamp: subDays(new Date(), 1),
      action: "ISSUE_CREATED",
      entity: "ISSUE",
      entityId: "issue-456",
      userId: "user-123",
      userName: "John Doe",
      userEmail: "john@example.com",
      details: "Created issue 'Machine overheating in location A'",
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      severity: "info"
    },
    {
      id: "activity-3",
      timestamp: subDays(new Date(), 2),
      action: "ROLE_CHANGED",
      entity: "USER",
      entityId: "user-789",
      userId: "user-admin",
      userName: "Admin User",
      userEmail: "admin@example.com",
      details: "Changed user role from 'Member' to 'Manager'",
      ipAddress: "10.0.0.50",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      severity: "warning"
    },
    {
      id: "activity-4",
      timestamp: subDays(new Date(), 3),
      action: "LOGIN_FAILED",
      entity: "USER",
      entityId: "user-456",
      userId: "user-456",
      userName: "Jane Smith",
      userEmail: "jane@example.com",
      details: "Failed login attempt - invalid password",
      ipAddress: "203.0.113.1",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)",
      severity: "error"
    }
  ];

  const totalEntries = mockActivityLog.length;
  const totalPages = Math.ceil(totalEntries / limit);

  const getActionIcon = (action: string) => {
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error":
        return "text-red-600 bg-red-50";
      case "warning":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-blue-600 bg-blue-50";
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
          <Button variant="outline" size="sm">
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export CSV
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
            <div className="text-2xl font-bold">{totalEntries}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Actions</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockActivityLog.filter(entry => 
                entry.action.includes("USER") || entry.action.includes("ISSUE")
              ).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <ShieldIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockActivityLog.filter(entry => 
                entry.action.includes("LOGIN") || entry.action.includes("ROLE")
              ).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {mockActivityLog.filter(entry => entry.severity === "error").length}
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
                  <div className={`p-2 rounded-lg ${getSeverityColor(entry.severity)}`}>
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
                        {format(entry.timestamp, "PPp")}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <UserIcon className="h-3 w-3" />
                        <span>{entry.userName}</span>
                        <span>({entry.userEmail})</span>
                      </div>
                      <span>•</span>
                      <span>IP: {entry.ipAddress}</span>
                      <span>•</span>
                      <span>Entity: {entry.entity}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalEntries)} of {totalEntries} entries
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
              >
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
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}