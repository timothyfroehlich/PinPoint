import { z } from "zod";

export const CollectionScalarFieldEnumSchema = z.enum([
  "id",
  "name",
  "typeId",
  "locationId",
  "isSmart",
  "isManual",
  "description",
  "sortOrder",
  "filterCriteria",
]);

export default CollectionScalarFieldEnumSchema;
