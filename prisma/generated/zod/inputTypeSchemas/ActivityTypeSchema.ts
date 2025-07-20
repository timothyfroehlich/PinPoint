import { z } from "zod";

export const ActivityTypeSchema = z.enum([
  "CREATED",
  "STATUS_CHANGED",
  "ASSIGNED",
  "PRIORITY_CHANGED",
  "COMMENTED",
  "COMMENT_DELETED",
  "ATTACHMENT_ADDED",
  "MERGED",
  "RESOLVED",
  "REOPENED",
  "SYSTEM",
]);

export type ActivityTypeType = `${z.infer<typeof ActivityTypeSchema>}`;

export default ActivityTypeSchema;
