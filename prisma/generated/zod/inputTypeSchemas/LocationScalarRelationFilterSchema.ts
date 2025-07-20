import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { LocationWhereInputSchema } from "./LocationWhereInputSchema";

export const LocationScalarRelationFilterSchema: z.ZodType<Prisma.LocationScalarRelationFilter> =
  z
    .object({
      is: z.lazy(() => LocationWhereInputSchema).optional(),
      isNot: z.lazy(() => LocationWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.LocationScalarRelationFilter>;

export default LocationScalarRelationFilterSchema;
