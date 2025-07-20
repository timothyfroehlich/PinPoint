import { z } from "zod";

export const AttachmentScalarFieldEnumSchema = z.enum([
  "id",
  "url",
  "fileName",
  "fileType",
  "createdAt",
  "organizationId",
  "issueId",
]);

export default AttachmentScalarFieldEnumSchema;
