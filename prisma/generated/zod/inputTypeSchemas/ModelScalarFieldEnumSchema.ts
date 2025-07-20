import { z } from "zod";

export const ModelScalarFieldEnumSchema = z.enum([
  "id",
  "name",
  "manufacturer",
  "year",
  "ipdbId",
  "opdbId",
  "machineType",
  "machineDisplay",
  "isActive",
  "ipdbLink",
  "opdbImgUrl",
  "kineticistUrl",
  "isCustom",
]);

export default ModelScalarFieldEnumSchema;
