/**
 * Notification Bell Wrapper - Server Component
 * Handles the server-client boundary for notification bell
 * Fixed: Removed server component children to prevent bundling issues
 */

import { NotificationBellClient } from "./notification-bell-client";
import { getUnreadNotificationCount } from "~/lib/dal/notifications";

interface NotificationBellWrapperProps {
  userId: string;
}

/**
 * Loading skeleton for notification bell
 */

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

