/**
 * Notifications List Server Component
 * Server-rendered notification dropdown content
 */

import React from "react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  AlertTriangleIcon,
  WrenchIcon,
  MessageSquareIcon,
  BuildingIcon,
  MegaphoneIcon,
  ExternalLinkIcon,
} from "lucide-react";
import {
  getUserNotifications,
  getNotificationStats,
} from "~/lib/dal/notifications";
import Link from "next/link";

interface NotificationListServerProps {
  userId: string;
  organizationId: string;
  limit?: number;
}

/**
 * Get appropriate icon based on notification type
 */
function getNotificationIcon(type: string): JSX.Element {
  switch (type) {
    case "ISSUE_CREATED":
    case "ISSUE_UPDATED":
    case "ISSUE_ASSIGNED":
      return <AlertTriangleIcon className="h-4 w-4" />;
    case "ISSUE_COMMENTED":
      return <MessageSquareIcon className="h-4 w-4" />;
    case "MACHINE_ASSIGNED":
      return <WrenchIcon className="h-4 w-4" />;
    case "SYSTEM_ANNOUNCEMENT":
      return <MegaphoneIcon className="h-4 w-4" />;
    default:
      return <BuildingIcon className="h-4 w-4" />;
  }
}

/**
 * Get appropriate color scheme based on notification type using Material 3 colors
 */
function getNotificationColor(type: string): string {
  switch (type) {
    case "ISSUE_CREATED":
      return "bg-error-container border-outline-variant text-on-error-container";
    case "ISSUE_UPDATED":
      return "bg-primary-container border-outline-variant text-on-primary-container";
    case "ISSUE_ASSIGNED":
      return "bg-secondary-container border-outline-variant text-on-secondary-container";
    case "ISSUE_COMMENTED":
      return "bg-tertiary-container border-outline-variant text-on-tertiary-container";
    case "MACHINE_ASSIGNED":
      return "bg-secondary-container border-outline-variant text-on-secondary-container";
    case "SYSTEM_ANNOUNCEMENT":
      return "bg-primary-container border-outline-variant text-on-primary-container";
    default:
      return "bg-surface-variant border-outline-variant text-on-surface-variant";
  }
}

export async function NotificationsListServer({
  userId,
  organizationId,
  limit = 10,
}: NotificationListServerProps): Promise<JSX.Element> {
  // Parallel data fetching for optimal performance
  const [notifications, stats] = await Promise.all([
    getUserNotifications(userId, organizationId, limit),
    getNotificationStats(userId, organizationId),
  ]);

  if (notifications.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="flex flex-col items-center justify-center py-8">
          <AlertTriangleIcon className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No notifications yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            You'll see updates about issues and assignments here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      {/* Notification Stats Header */}
      {stats.unread > 0 && (
        <div className="p-3 bg-primary-container border-b">
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-primary-container font-medium">
              {stats.unread} unread notification{stats.unread !== 1 ? "s" : ""}
            </span>
            <Badge variant="secondary" className="text-xs">
              {stats.today} today
            </Badge>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="divide-y divide-border">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 hover:bg-muted/50 transition-colors ${
              !notification.read ? "bg-primary-container/30" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Notification Icon */}
              <div
                className={`p-1.5 rounded-full ${getNotificationColor(notification.type)}`}
              >
                {getNotificationIcon(notification.type)}
              </div>

              {/* Notification Content */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium leading-tight">
                    {notification.message}
                  </p>
                  {!notification.read && (
                    <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0" />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at))} ago
                  </span>

                  {/* Action Button */}
                  {notification.action_url && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href={notification.action_url}
                        className="flex items-center gap-1 text-xs"
                      >
                        View
                        <ExternalLinkIcon className="h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View All Link */}
      <div className="p-3 border-t bg-muted/20">
        <Button variant="ghost" size="sm" className="w-full" asChild>
          <Link href="/notifications">View all notifications</Link>
        </Button>
      </div>
    </div>
  );
}
