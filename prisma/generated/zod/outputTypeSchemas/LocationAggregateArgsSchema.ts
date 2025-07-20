import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { LocationWhereInputSchema } from "../inputTypeSchemas/LocationWhereInputSchema";
import { LocationOrderByWithRelationInputSchema } from "../inputTypeSchemas/LocationOrderByWithRelationInputSchema";
import { LocationWhereUniqueInputSchema } from "../inputTypeSchemas/LocationWhereUniqueInputSchema";

export const LocationAggregateArgsSchema: z.ZodType<Prisma.LocationAggregateArgs> =
  z
    .object({
      where: LocationWhereInputSchema.optional(),
      orderBy: z
        .union([
          LocationOrderByWithRelationInputSchema.array(),
          LocationOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: LocationWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.LocationAggregateArgs>;

export default LocationAggregateArgsSchema;
