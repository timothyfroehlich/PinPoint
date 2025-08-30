/**
 * Notification Bell Wrapper - Server Component
 * Handles the server-client boundary for notification bell
 * Fixed: Removed server component children to prevent bundling issues
 */

import { NotificationBellClient } from "./notification-bell-client";
import { getUnreadNotificationCount } from "~/lib/dal/notifications";
import { Skeleton } from "~/components/ui/skeleton";

interface NotificationBellWrapperProps {
  userId: string;
}

/**
 * Loading skeleton for notification bell
 */
function NotificationBellSkeleton() {
  return (
    <div className="flex items-center justify-center w-10 h-10">
      <Skeleton className="h-5 w-5 rounded" />
    </div>
  );
}

/**
 * Server wrapper that provides notification data to client islands
 * Fixed: Simplified to avoid server components in client children
 */
export async function NotificationBellWrapper({ userId }: NotificationBellWrapperProps) {
  const unreadCount = await getUnreadNotificationCount();

  return (
    <div className="relative">
      {/* Client island for bell icon and real-time updates */}
      <NotificationBellClient
        initialUnreadCount={unreadCount}
        userId={userId}
      />
    </div>
  );
}

/**
 * Loading skeleton for notification list
 */
function NotificationListSkeleton() {
  return (
    <div className="w-80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-12" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}