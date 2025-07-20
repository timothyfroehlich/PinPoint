import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { LocationWhereInputSchema } from './LocationWhereInputSchema';
import { StringFilterSchema } from './StringFilterSchema';
import { StringNullableFilterSchema } from './StringNullableFilterSchema';
import { FloatNullableFilterSchema } from './FloatNullableFilterSchema';
import { IntNullableFilterSchema } from './IntNullableFilterSchema';
import { DateTimeNullableFilterSchema } from './DateTimeNullableFilterSchema';
import { BoolFilterSchema } from './BoolFilterSchema';
import { OrganizationScalarRelationFilterSchema } from './OrganizationScalarRelationFilterSchema';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { MachineListRelationFilterSchema } from './MachineListRelationFilterSchema';
import { CollectionListRelationFilterSchema } from './CollectionListRelationFilterSchema';

export const LocationWhereUniqueInputSchema: z.ZodType<Prisma.LocationWhereUniqueInput> = z.object({
  id: z.string().cuid()
})
.and(z.object({
  id: z.string().cuid().optional(),
  AND: z.union([ z.lazy(() => LocationWhereInputSchema),z.lazy(() => LocationWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => LocationWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => LocationWhereInputSchema),z.lazy(() => LocationWhereInputSchema).array() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  street: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  city: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  state: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  zip: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  phone: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  website: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  latitude: z.union([ z.lazy(() => FloatNullableFilterSchema),z.number() ]).optional().nullable(),
  longitude: z.union([ z.lazy(() => FloatNullableFilterSchema),z.number() ]).optional().nullable(),
  description: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  pinballMapId: z.union([ z.lazy(() => IntNullableFilterSchema),z.number().int() ]).optional().nullable(),
  regionId: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  lastSyncAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema),z.coerce.date() ]).optional().nullable(),
  syncEnabled: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  organization: z.union([ z.lazy(() => OrganizationScalarRelationFilterSchema),z.lazy(() => OrganizationWhereInputSchema) ]).optional(),
  machines: z.lazy(() => MachineListRelationFilterSchema).optional(),
  collections: z.lazy(() => CollectionListRelationFilterSchema).optional()
}).strict());

export default LocationWhereUniqueInputSchema;
