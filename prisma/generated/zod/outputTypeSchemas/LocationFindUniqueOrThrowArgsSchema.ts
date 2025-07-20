import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { LocationIncludeSchema } from '../inputTypeSchemas/LocationIncludeSchema'
import { LocationWhereUniqueInputSchema } from '../inputTypeSchemas/LocationWhereUniqueInputSchema'
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"
import { MachineFindManyArgsSchema } from "../outputTypeSchemas/MachineFindManyArgsSchema"
import { CollectionFindManyArgsSchema } from "../outputTypeSchemas/CollectionFindManyArgsSchema"
import { LocationCountOutputTypeArgsSchema } from "../outputTypeSchemas/LocationCountOutputTypeArgsSchema"
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const LocationSelectSchema: z.ZodType<Prisma.LocationSelect> = z.object({
  id: z.boolean().optional(),
  name: z.boolean().optional(),
  organizationId: z.boolean().optional(),
  street: z.boolean().optional(),
  city: z.boolean().optional(),
  state: z.boolean().optional(),
  zip: z.boolean().optional(),
  phone: z.boolean().optional(),
  website: z.boolean().optional(),
  latitude: z.boolean().optional(),
  longitude: z.boolean().optional(),
  description: z.boolean().optional(),
  pinballMapId: z.boolean().optional(),
  regionId: z.boolean().optional(),
  lastSyncAt: z.boolean().optional(),
  syncEnabled: z.boolean().optional(),
  organization: z.union([z.boolean(),z.lazy(() => OrganizationArgsSchema)]).optional(),
  machines: z.union([z.boolean(),z.lazy(() => MachineFindManyArgsSchema)]).optional(),
  collections: z.union([z.boolean(),z.lazy(() => CollectionFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => LocationCountOutputTypeArgsSchema)]).optional(),
}).strict()

export const LocationFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.LocationFindUniqueOrThrowArgs> = z.object({
  select: LocationSelectSchema.optional(),
  include: z.lazy(() => LocationIncludeSchema).optional(),
  where: LocationWhereUniqueInputSchema,
}).strict() ;

export default LocationFindUniqueOrThrowArgsSchema;
