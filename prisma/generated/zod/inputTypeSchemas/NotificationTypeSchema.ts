import { z } from "zod";

export const NotificationTypeSchema = z.enum([
  "ISSUE_CREATED",
  "ISSUE_UPDATED",
  "ISSUE_ASSIGNED",
  "ISSUE_COMMENTED",
  "MACHINE_ASSIGNED",
  "SYSTEM_ANNOUNCEMENT",
]);

export type NotificationTypeType = `${z.infer<typeof NotificationTypeSchema>}`;

export default NotificationTypeSchema;
