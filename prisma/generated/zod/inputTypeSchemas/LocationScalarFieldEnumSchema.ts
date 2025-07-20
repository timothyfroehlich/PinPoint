import { z } from "zod";

export const LocationScalarFieldEnumSchema = z.enum([
  "id",
  "name",
  "organizationId",
  "street",
  "city",
  "state",
  "zip",
  "phone",
  "website",
  "latitude",
  "longitude",
  "description",
  "pinballMapId",
  "regionId",
  "lastSyncAt",
  "syncEnabled",
]);

export default LocationScalarFieldEnumSchema;
