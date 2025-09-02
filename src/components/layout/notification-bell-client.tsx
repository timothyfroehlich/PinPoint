/**
 * Notification Bell Client Island
 * Phase 4A: Real-time notification count and dropdown
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Badge } from "~/components/ui/badge";
import { BellIcon, BellRingIcon } from "lucide-react";
interface NotificationBellClientProps {
  initialUnreadCount: number;
  userId: string;
}

export function NotificationBellClient({
  initialUnreadCount,
  userId,
}: NotificationBellClientProps) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  useEffect(() => {
    // Import Supabase client dynamically to avoid SSR issues
    const initializeRealtimeConnection = async () => {
      try {
        const { createClient } = await import("~/utils/supabase/client");
        const supabase = createClient();

        setIsConnected(true);

        const channel = supabase
          .channel(`user-${userId}-notifications`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            () => {
              // New notification received
              setUnreadCount((prev) => prev + 1);
              setHasNewNotifications(true);

              // Clear new notification indicator after 3 seconds
              setTimeout(() => {
                setHasNewNotifications(false);
              }, 3000);
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              // Notification was marked as read
              if (
                payload.old["read"] === false &&
                payload.new["read"] === true
              ) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
              }
              // Notification was marked as unread
              else if (
                payload.old["read"] === true &&
                payload.new["read"] === false
              ) {
                setUnreadCount((prev) => prev + 1);
              }
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              setIsConnected(true);
            } else if (status === "CHANNEL_ERROR") {
              setIsConnected(false);
            }
          });

        return () => {
          void supabase.removeChannel(channel);
          setIsConnected(false);
        };
      } catch (error) {
        console.error(
          "Failed to initialize notification realtime connection:",
          error,
        );
        setIsConnected(false);
        return () => {
          // No-op cleanup function on error
        };
      }
    };

    let cleanupFunction: (() => void) | null = null;

    // Initialize async connection and store cleanup function
    void initializeRealtimeConnection()
      .then((cleanup) => {
        cleanupFunction = cleanup;
      })
      .catch(console.error);

    return () => {
      if (cleanupFunction) {
        cleanupFunction();
      }
    };
  }, [userId]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);

    // Clear new notifications indicator when opened
    if (open) {
      setHasNewNotifications(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-muted"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          {hasNewNotifications || unreadCount > 0 ? (
            <BellRingIcon
              className={`h-5 w-5 ${hasNewNotifications ? "animate-pulse text-primary" : ""}`}
            />
          ) : (
            <BellIcon className="h-5 w-5" />
          )}

          {/* Unread Count Badge */}
          {unreadCount > 0 && (
            <Badge
              variant={hasNewNotifications ? "destructive" : "secondary"}
              className={`absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0 min-w-0 ${
                hasNewNotifications ? "animate-pulse" : ""
              }`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}

          {/* Connection Status Indicator (subtle) */}
          {!isConnected && unreadCount === 0 && (
            <div className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-secondary rounded-full" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Notifications</h4>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge variant="secondary" className="text-xs">
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Offline
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Simplified notification display */}
        <div className="p-4 text-center text-sm text-muted-foreground">
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "No new notifications"}
        </div>
      </PopoverContent>
    </Popover>
  );
}
