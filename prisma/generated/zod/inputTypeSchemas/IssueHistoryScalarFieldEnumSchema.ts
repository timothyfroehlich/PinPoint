import { z } from "zod";

export const IssueHistoryScalarFieldEnumSchema = z.enum([
  "id",
  "field",
  "oldValue",
  "newValue",
  "changedAt",
  "organizationId",
  "actorId",
  "type",
  "issueId",
]);

export default IssueHistoryScalarFieldEnumSchema;
