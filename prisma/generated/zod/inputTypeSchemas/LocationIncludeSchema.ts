import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"
import { MachineFindManyArgsSchema } from "../outputTypeSchemas/MachineFindManyArgsSchema"
import { CollectionFindManyArgsSchema } from "../outputTypeSchemas/CollectionFindManyArgsSchema"
import { LocationCountOutputTypeArgsSchema } from "../outputTypeSchemas/LocationCountOutputTypeArgsSchema"

export const LocationIncludeSchema: z.ZodType<Prisma.LocationInclude> = z.object({
  organization: z.union([z.boolean(),z.lazy(() => OrganizationArgsSchema)]).optional(),
  machines: z.union([z.boolean(),z.lazy(() => MachineFindManyArgsSchema)]).optional(),
  collections: z.union([z.boolean(),z.lazy(() => CollectionFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => LocationCountOutputTypeArgsSchema)]).optional(),
}).strict()

export default LocationIncludeSchema;
