import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const LocationCountOutputTypeSelectSchema: z.ZodType<Prisma.LocationCountOutputTypeSelect> =
  z
    .object({
      machines: z.boolean().optional(),
      collections: z.boolean().optional(),
    })
    .strict();

export default LocationCountOutputTypeSelectSchema;
