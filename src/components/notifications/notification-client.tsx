/**
 * Notification Client Island
 * Phase 3D: Focused client island for real-time notifications
 * Handles system-wide notifications and updates
 */

"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  CheckCircleIcon,
  XCircleIcon,
  InfoIcon,
  AlertCircleIcon,
  XIcon,
  BellIcon,
} from "lucide-react";

interface Notification {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  timestamp: Date;
  autoHide?: boolean;
  actions?: {
    label: string;
    action: () => void;
  }[];
}

// Custom event type definitions for type safety
interface MachineUpdateEventDetail {
  machineName: string;
}

interface FormSubmissionEventDetail {
  success: boolean;
  title?: string;
  message?: string;
}

interface IssueCreatedEventDetail {
  title: string;
  machineId?: string;
}

// Supabase notification payload type
interface NotificationPayload {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  auto_hide: boolean;
  organization_id: string;
  created_at: string;
}

// Type-safe custom event interfaces
interface MachineUpdateEvent extends CustomEvent {
  detail: MachineUpdateEventDetail;
}

interface FormSubmissionEvent extends CustomEvent {
  detail: FormSubmissionEventDetail;
}

interface IssueCreatedEvent extends CustomEvent {
  detail: IssueCreatedEventDetail;
}

interface NotificationClientProps {
  userId?: string;
  organizationId?: string;
  maxNotifications?: number;
  autoHideDelay?: number;
}

const NOTIFICATION_ICONS = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  info: InfoIcon,
  warning: AlertCircleIcon,
};

const NOTIFICATION_STYLES = {
  success: "border-tertiary bg-tertiary-container text-on-tertiary-container",
  error: "border-error bg-error-container text-on-error-container",
  info: "border-primary bg-primary-container text-on-primary-container",
  warning:
    "border-secondary bg-secondary-container text-on-secondary-container",
};

/**
 * Global notification system client island
 * Listens for real-time notifications and system events
 */
export function NotificationClient({
  userId,
  organizationId,
  maxNotifications = 5,
  autoHideDelay = 5000,
}: NotificationClientProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Listen for custom events from other client islands
  useEffect(() => {
    const handleIssueUpdate: EventListener = (_event) => {
      addNotification({
        type: "success",
        title: "Issue Updated",
        message: `Issue has been updated successfully`,
        autoHide: true,
      });
    };

    const handleMachineUpdate = (event: Event) => {
      const customEvent = event as MachineUpdateEvent;
      addNotification({
        type: "info",
        title: "Machine Updated",
        message: `Machine "${String(customEvent.detail?.machineName ?? "Unknown")}" has been updated`,
        autoHide: true,
      });
    };

    const handleFormSubmission = (event: Event) => {
      const customEvent = event as FormSubmissionEvent;
      if (customEvent.detail.success) {
        addNotification({
          type: "success",
          title: customEvent.detail.title ?? "Success",
          message:
            customEvent.detail.message ?? "Operation completed successfully",
          autoHide: true,
        });
      } else {
        addNotification({
          type: "error",
          title: customEvent.detail.title ?? "Error",
          message: customEvent.detail.message ?? "Operation failed",
          autoHide: false,
        });
      }
    };

    window.addEventListener("issueUpdated", handleIssueUpdate);
    window.addEventListener("machineUpdated", handleMachineUpdate);
    window.addEventListener("formSubmission", handleFormSubmission);

    return () => {
      window.removeEventListener("issueUpdated", handleIssueUpdate);
      window.removeEventListener("machineUpdated", handleMachineUpdate);
      window.removeEventListener("formSubmission", handleFormSubmission);
    };
  }, []);

  // Initialize real-time connection for system notifications
  useEffect(() => {
    if (!userId || !organizationId) return;

    const initializeNotificationStream = async () => {
      try {
        const { createClient } = await import("~/utils/supabase/client");
        const supabase = createClient();

        setIsConnected(true);

        // Listen for organization-wide notifications
        const orgChannel = supabase
          .channel(`org-${organizationId}-notifications`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `organization_id=eq.${organizationId}`,
            },
            (payload) => {
              if (payload.new) {
                const notification = payload.new as NotificationPayload;
                addNotification({
                  type: notification.type ?? "info",
                  title: notification.title ?? "Notification",
                  message: notification.message ?? "",
                  autoHide: notification.auto_hide,
                });
              }
            },
          )
          .subscribe();

        return () => {
          void supabase.removeChannel(orgChannel);
          setIsConnected(false);
        };
      } catch (error) {
        console.error("Failed to initialize notification stream:", error);
        setIsConnected(false);
        return () => {
          // No-op cleanup function on error
        };
      }
    };

    const cleanup = initializeNotificationStream();
    return () => {
      void cleanup.then((fn) => {
        fn?.();
      });
    };
  }, [userId, organizationId]);

  const addNotification = (
    notification: Omit<Notification, "id" | "timestamp">,
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };

    setNotifications((prev) => {
      const updated = [newNotification, ...prev].slice(0, maxNotifications);
      return updated;
    });

    // Auto-hide if specified
    if (notification.autoHide !== false) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, autoHideDelay);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Don't render if no notifications
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {/* Connection status (only show if disconnected) */}
      {!isConnected && userId && (
        <Alert className="border-secondary bg-secondary-container">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <div className="flex items-center justify-between">
              <span>Notifications offline</span>
              <Badge variant="outline" className="text-xs">
                <BellIcon className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Notification list */}
      {notifications.map((notification) => {
        const Icon = NOTIFICATION_ICONS[notification.type];
        const styleClass = NOTIFICATION_STYLES[notification.type];

        return (
          <Alert key={notification.id} className={`${styleClass} shadow-lg`}>
            <Icon className="h-4 w-4" />
            <div className="flex justify-between items-start">
              <AlertDescription className="flex-1">
                <div className="font-medium text-sm mb-1">
                  {notification.title}
                </div>
                <div className="text-sm">{notification.message}</div>

                {/* Action buttons */}
                {notification.actions && notification.actions.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {notification.actions.map((action, index) => (
                      <Button
                        key={index}
                        size="sm"
                        variant="outline"
                        onClick={action.action}
                        className="h-6 text-xs"
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </AlertDescription>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  removeNotification(notification.id);
                }}
                className="h-6 w-6 p-0 ml-2"
              >
                <XIcon className="h-3 w-3" />
              </Button>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
