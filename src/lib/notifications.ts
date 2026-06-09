// Shim — public API preserved. Real logic in ./notifications/dispatch.
export {
  createNotification,
  planNotification,
  dispatchNotification,
  getChannels,
  type NotificationType,
  type CreateNotificationProps,
  type NotificationChannel,
  type DeliveryPlan,
} from "./notifications/dispatch";
