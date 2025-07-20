import { z } from "zod";

export const IssueStatusScalarFieldEnumSchema = z.enum([
  "id",
  "name",
  "category",
  "organizationId",
  "isDefault",
]);

export default IssueStatusScalarFieldEnumSchema;
