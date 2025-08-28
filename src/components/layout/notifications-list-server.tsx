/**
 * Notifications List Server Component
 * Server-rendered notification dropdown content
 */

import { formatDistanceToNow } from "date-fns";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  AlertTriangleIcon,
  WrenchIcon,
  MessageSquareIcon,
  BuildingIcon,
  MegaphoneIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { getUserNotifications, getNotificationStats } from "~/lib/dal/notifications";
import Link from "next/link";

interface NotificationListServerProps {
  limit?: number;
}

/**
 * Get appropriate icon based on notification type
 */
function getNotificationIcon(type: string) {
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
 * Get appropriate color scheme based on notification type
 */
function getNotificationColor(type: string) {
  switch (type) {
    case "ISSUE_CREATED":
      return "bg-red-50 border-red-200 text-red-800";
    case "ISSUE_UPDATED":
      return "bg-blue-50 border-blue-200 text-blue-800";
    case "ISSUE_ASSIGNED":
      return "bg-yellow-50 border-yellow-200 text-yellow-800";
    case "ISSUE_COMMENTED":
      return "bg-green-50 border-green-200 text-green-800";
    case "MACHINE_ASSIGNED":
      return "bg-purple-50 border-purple-200 text-purple-800";
    case "SYSTEM_ANNOUNCEMENT":
      return "bg-indigo-50 border-indigo-200 text-indigo-800";
    default:
      return "bg-gray-50 border-gray-200 text-gray-800";
  }
}

export async function NotificationsListServer({ 
  limit = 10 
}: NotificationListServerProps) {
  // Parallel data fetching for optimal performance
  const [notifications, stats] = await Promise.all([
    getUserNotifications(limit),
    getNotificationStats(),
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
        <div className="p-3 bg-blue-50 border-b">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-800 font-medium">
              {stats.unread} unread notification{stats.unread !== 1 ? 's' : ''}
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
              !notification.read ? "bg-blue-50/30" : ""
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
                    <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0" />
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
          <Link href="/notifications">
            View all notifications
          </Link>
        </Button>
      </div>
    </div>
  );
}