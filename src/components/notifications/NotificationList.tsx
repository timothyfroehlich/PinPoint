"use client";

import React, { useTransition, useState } from "react";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import type { NotificationType } from "~/lib/notifications";

/** Minimal notification shape for client rendering (CORE-SEC-006) */
export interface EnrichedNotification {
  id: string;
  type: NotificationType;
  createdAt: Date;
  link: string;
  machineInitials?: string | undefined;
  issueNumber?: number | undefined;
}

interface NotificationListProps {
  notifications: EnrichedNotification[]; // Use EnrichedNotification here
}

export function NotificationList({
  notifications,
}: NotificationListProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Notifications passed in are already unread (read ones are deleted)
  const unreadCount = notifications.length;

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
      setIsOpen(false);
    });
  };

  const getNotificationText = (n: EnrichedNotification): string => {
    const issueId =
      n.machineInitials && n.issueNumber
        ? `${n.machineInitials}-${n.issueNumber}`
        : "issue";

    switch (n.type) {
      case "issue_assigned":
        return `Assigned to ${issueId}`;
      case "issue_status_changed":
        return `Status updated for ${issueId}`;
      case "new_issue":
        return `New report ${issueId}`;
      case "new_comment":
        return `New comment on ${issueId}`;
      default:
        return "New notification";
    }
  };

  const getLink = (n: EnrichedNotification): string => {
    // We expect 'link' to always be present for EnrichedNotification
    return n.link;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-80">
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
            No new notifications
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem key={notification.id} asChild>
                <Link
                  href={getLink(notification)}
                  className="flex w-full flex-col items-start gap-1 rounded-sm p-3 hover:bg-accent cursor-pointer text-left"
                  onClick={() => {
                    setIsOpen(false);
                    // Fire and forget mark as read
                    void markAsReadAction(notification.id);
                  }}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="font-medium text-sm">
                      {getNotificationText(notification)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-background/80"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMarkAsRead(notification.id);
                        }}
                      >
                        <span className="sr-only">Dismiss</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="opacity-60 hover:opacity-100"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground self-end">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                    })}
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
