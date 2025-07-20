import { z } from "zod";

export const NotificationScalarFieldEnumSchema = z.enum([
  "id",
  "message",
  "read",
  "createdAt",
  "userId",
  "type",
  "entityType",
  "entityId",
  "actionUrl",
]);

export default NotificationScalarFieldEnumSchema;
