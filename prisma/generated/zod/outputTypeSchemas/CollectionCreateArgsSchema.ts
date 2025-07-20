import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionIncludeSchema } from "../inputTypeSchemas/CollectionIncludeSchema";
import { CollectionCreateInputSchema } from "../inputTypeSchemas/CollectionCreateInputSchema";
import { CollectionUncheckedCreateInputSchema } from "../inputTypeSchemas/CollectionUncheckedCreateInputSchema";
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

export const CollectionCreateArgsSchema: z.ZodType<Prisma.CollectionCreateArgs> =
  z
    .object({
      select: CollectionSelectSchema.optional(),
      include: z.lazy(() => CollectionIncludeSchema).optional(),
      data: z.union([
        CollectionCreateInputSchema,
        CollectionUncheckedCreateInputSchema,
      ]),
    })
    .strict() as z.ZodType<Prisma.CollectionCreateArgs>;

export default CollectionCreateArgsSchema;
