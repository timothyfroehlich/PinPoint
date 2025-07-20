import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { CollectionTypeArgsSchema } from "../outputTypeSchemas/CollectionTypeArgsSchema";
import { LocationArgsSchema } from "../outputTypeSchemas/LocationArgsSchema";
import { MachineFindManyArgsSchema } from "../outputTypeSchemas/MachineFindManyArgsSchema";
import { CollectionCountOutputTypeArgsSchema } from "../outputTypeSchemas/CollectionCountOutputTypeArgsSchema";

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

export default CollectionSelectSchema;
