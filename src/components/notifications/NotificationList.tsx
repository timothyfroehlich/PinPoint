"use client";

import React, { useTransition } from "react";
import { Bell } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  markAsReadAction,
  markAllAsReadAction,
} from "~/app/(app)/notifications/actions";
import { cn } from "~/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: "issue_assigned" | "issue_status_changed" | "new_comment" | "new_issue";
  resourceId: string;
  resourceType: "issue" | "machine";
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationListProps {
  notifications: Notification[];
}

export function NotificationList({
  notifications,
}: NotificationListProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const handleMarkAsRead = (id: string): void => {
    startTransition(async () => {
      await markAsReadAction(id);
      router.refresh();
    });
  };

  const handleMarkAllAsRead = (): void => {
    startTransition(async () => {
      await markAllAsReadAction();
      router.refresh();
    });
  };

  const getNotificationText = (n: Notification): string => {
    switch (n.type) {
      case "issue_assigned":
        return "You were assigned to an issue";
      case "issue_status_changed":
        return "Issue status updated";
      case "new_comment":
        return "New comment on issue";
      case "new_issue":
        return "New issue reported";
      default:
        return "New notification";
    }
  };

  const getLink = (n: Notification): string => {
    if (n.resourceType === "issue") return `/issues/${n.resourceId}`;
    return `/machines/${n.resourceId}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 size-2 rounded-full bg-primary" />
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
              onClick={handleMarkAllAsRead}
              disabled={isPending}
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem key={notification.id} asChild>
                <Link
                  href={getLink(notification)}
                  className={cn(
                    "flex flex-col gap-1 p-3 cursor-pointer",
                    !notification.readAt && "bg-muted/50"
                  )}
                  onClick={() => {
                    if (!notification.readAt) {
                      handleMarkAsRead(notification.id);
                    }
                  }}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="font-medium text-sm">
                      {getNotificationText(notification)}
                    </span>
                    {!notification.readAt && (
                      <span className="size-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
