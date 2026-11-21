// Shim — public API preserved. Real logic in ./notifications/dispatch.
export {
  createNotification,
  planNotification,
  planNotifications,
  dispatchNotification,
  getChannels,
  type NotificationType,
  type NotificationEvent,
  type NotificationChannel,
  type DeliveryPlan,
} from "./notifications/dispatch";
