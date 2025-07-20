import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"
import { CollectionFindManyArgsSchema } from "../outputTypeSchemas/CollectionFindManyArgsSchema"
import { CollectionTypeCountOutputTypeArgsSchema } from "../outputTypeSchemas/CollectionTypeCountOutputTypeArgsSchema"

export const CollectionTypeIncludeSchema: z.ZodType<Prisma.CollectionTypeInclude> = z.object({
  organization: z.union([z.boolean(),z.lazy(() => OrganizationArgsSchema)]).optional(),
  collections: z.union([z.boolean(),z.lazy(() => CollectionFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => CollectionTypeCountOutputTypeArgsSchema)]).optional(),
}).strict()

export default CollectionTypeIncludeSchema;
