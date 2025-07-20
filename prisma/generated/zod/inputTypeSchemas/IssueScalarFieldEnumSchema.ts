import { z } from "zod";

export const IssueScalarFieldEnumSchema = z.enum([
  "id",
  "title",
  "description",
  "consistency",
  "checklist",
  "createdAt",
  "updatedAt",
  "resolvedAt",
  "organizationId",
  "machineId",
  "statusId",
  "priorityId",
  "createdById",
  "assignedToId",
]);

export default IssueScalarFieldEnumSchema;
