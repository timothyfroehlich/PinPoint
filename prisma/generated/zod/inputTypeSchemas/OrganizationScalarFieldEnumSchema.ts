import { z } from "zod";

export const OrganizationScalarFieldEnumSchema = z.enum([
  "id",
  "name",
  "subdomain",
  "logoUrl",
  "createdAt",
  "updatedAt",
]);

export default OrganizationScalarFieldEnumSchema;
