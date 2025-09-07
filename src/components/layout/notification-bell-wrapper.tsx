/**
 * Notification Bell Wrapper - Server Component
 * Handles the server-client boundary for notification bell
 * Fixed: Removed server component children to prevent bundling issues
 */

import React from "react";
import { NotificationBellClient } from "./notification-bell-client";
import { getUnreadNotificationCount } from "~/lib/dal/notifications";

interface NotificationBellWrapperProps {
  userId: string;
  organizationId: string;
}

/**
 * Loading skeleton for notification bell
 */

/**
 * Server wrapper that provides notification data to client islands
 * Fixed: Simplified to avoid server components in client children
 */
export async function NotificationBellWrapper({
  userId,
  organizationId,
}: NotificationBellWrapperProps): Promise<JSX.Element> {
  const unreadCount = await getUnreadNotificationCount(userId, organizationId);

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
