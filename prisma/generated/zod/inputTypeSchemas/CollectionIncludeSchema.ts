import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CollectionTypeArgsSchema } from "../outputTypeSchemas/CollectionTypeArgsSchema"
import { LocationArgsSchema } from "../outputTypeSchemas/LocationArgsSchema"
import { MachineFindManyArgsSchema } from "../outputTypeSchemas/MachineFindManyArgsSchema"
import { CollectionCountOutputTypeArgsSchema } from "../outputTypeSchemas/CollectionCountOutputTypeArgsSchema"

export const CollectionIncludeSchema: z.ZodType<Prisma.CollectionInclude> = z.object({
  type: z.union([z.boolean(),z.lazy(() => CollectionTypeArgsSchema)]).optional(),
  location: z.union([z.boolean(),z.lazy(() => LocationArgsSchema)]).optional(),
  machines: z.union([z.boolean(),z.lazy(() => MachineFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => CollectionCountOutputTypeArgsSchema)]).optional(),
}).strict()

export default CollectionIncludeSchema;
