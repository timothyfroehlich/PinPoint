// Shim — public API preserved. Real logic in ./notifications/dispatch.
export {
  createNotification,
  getChannels,
  type NotificationType,
  type CreateNotificationProps,
  type NotificationChannel,
} from "./notifications/dispatch";
