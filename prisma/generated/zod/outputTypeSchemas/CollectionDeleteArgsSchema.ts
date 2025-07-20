import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionIncludeSchema } from "../inputTypeSchemas/CollectionIncludeSchema";
import { CollectionWhereUniqueInputSchema } from "../inputTypeSchemas/CollectionWhereUniqueInputSchema";
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

export const CollectionDeleteArgsSchema: z.ZodType<Prisma.CollectionDeleteArgs> =
  z
    .object({
      select: CollectionSelectSchema.optional(),
      include: z.lazy(() => CollectionIncludeSchema).optional(),
      where: CollectionWhereUniqueInputSchema,
    })
    .strict() as z.ZodType<Prisma.CollectionDeleteArgs>;

export default CollectionDeleteArgsSchema;
