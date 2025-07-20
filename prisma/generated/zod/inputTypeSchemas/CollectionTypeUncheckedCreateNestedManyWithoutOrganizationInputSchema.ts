import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionTypeCreateWithoutOrganizationInputSchema } from './CollectionTypeCreateWithoutOrganizationInputSchema';
import { CollectionTypeUncheckedCreateWithoutOrganizationInputSchema } from './CollectionTypeUncheckedCreateWithoutOrganizationInputSchema';
import { CollectionTypeCreateOrConnectWithoutOrganizationInputSchema } from './CollectionTypeCreateOrConnectWithoutOrganizationInputSchema';
import { CollectionTypeCreateManyOrganizationInputEnvelopeSchema } from './CollectionTypeCreateManyOrganizationInputEnvelopeSchema';
import { CollectionTypeWhereUniqueInputSchema } from './CollectionTypeWhereUniqueInputSchema';

export const CollectionTypeUncheckedCreateNestedManyWithoutOrganizationInputSchema: z.ZodType<Prisma.CollectionTypeUncheckedCreateNestedManyWithoutOrganizationInput> = z.object({
  create: z.union([ z.lazy(() => CollectionTypeCreateWithoutOrganizationInputSchema),z.lazy(() => CollectionTypeCreateWithoutOrganizationInputSchema).array(),z.lazy(() => CollectionTypeUncheckedCreateWithoutOrganizationInputSchema),z.lazy(() => CollectionTypeUncheckedCreateWithoutOrganizationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CollectionTypeCreateOrConnectWithoutOrganizationInputSchema),z.lazy(() => CollectionTypeCreateOrConnectWithoutOrganizationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CollectionTypeCreateManyOrganizationInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => CollectionTypeWhereUniqueInputSchema),z.lazy(() => CollectionTypeWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default CollectionTypeUncheckedCreateNestedManyWithoutOrganizationInputSchema;
