import { z } from "zod";

export const PriorityScalarFieldEnumSchema = z.enum([
  "id",
  "name",
  "order",
  "organizationId",
  "isDefault",
]);

export default PriorityScalarFieldEnumSchema;
