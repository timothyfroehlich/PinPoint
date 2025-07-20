import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { LocationWhereInputSchema } from "./LocationWhereInputSchema";

export const LocationNullableScalarRelationFilterSchema: z.ZodType<Prisma.LocationNullableScalarRelationFilter> =
  z
    .object({
      is: z
        .lazy(() => LocationWhereInputSchema)
        .optional()
        .nullable(),
      isNot: z
        .lazy(() => LocationWhereInputSchema)
        .optional()
        .nullable(),
    })
    .strict() as z.ZodType<Prisma.LocationNullableScalarRelationFilter>;

export default LocationNullableScalarRelationFilterSchema;
