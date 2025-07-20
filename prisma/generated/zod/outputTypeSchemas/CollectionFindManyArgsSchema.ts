import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionIncludeSchema } from "../inputTypeSchemas/CollectionIncludeSchema";
import { CollectionWhereInputSchema } from "../inputTypeSchemas/CollectionWhereInputSchema";
import { CollectionOrderByWithRelationInputSchema } from "../inputTypeSchemas/CollectionOrderByWithRelationInputSchema";
import { CollectionWhereUniqueInputSchema } from "../inputTypeSchemas/CollectionWhereUniqueInputSchema";
import { CollectionScalarFieldEnumSchema } from "../inputTypeSchemas/CollectionScalarFieldEnumSchema";
import { CollectionTypeArgsSchema } from "../outputTypeSchemas/CollectionTypeArgsSchema";
import { LocationArgsSchema } from "../outputTypeSchemas/LocationArgsSchema";
import { MachineFindManyArgsSchema } from "../outputTypeSchemas/MachineFindManyArgsSchema";
import { CollectionCountOutputTypeArgsSchema } from "../outputTypeSchemas/CollectionCountOutputTypeArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const CollectionSelectSchema: z.ZodType<Prisma.CollectionSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    typeId: z.boolean().optional(),
    locationId: z.boolean().optional(),
    isSmart: z.boolean().optional(),
    isManual: z.boolean().optional(),
    description: z.boolean().optional(),
    sortOrder: z.boolean().optional(),
    filterCriteria: z.boolean().optional(),
    type: z
      .union([z.boolean(), z.lazy(() => CollectionTypeArgsSchema)])
      .optional(),
    location: z
      .union([z.boolean(), z.lazy(() => LocationArgsSchema)])
      .optional(),
    machines: z
      .union([z.boolean(), z.lazy(() => MachineFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => CollectionCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export const CollectionFindManyArgsSchema: z.ZodType<Prisma.CollectionFindManyArgs> =
  z
    .object({
      select: CollectionSelectSchema.optional(),
      include: z.lazy(() => CollectionIncludeSchema).optional(),
      where: CollectionWhereInputSchema.optional(),
      orderBy: z
        .union([
          CollectionOrderByWithRelationInputSchema.array(),
          CollectionOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: CollectionWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
      distinct: z
        .union([
          CollectionScalarFieldEnumSchema,
          CollectionScalarFieldEnumSchema.array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionFindManyArgs>;

export default CollectionFindManyArgsSchema;
