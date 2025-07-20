import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionTypeScalarWhereInputSchema } from './CollectionTypeScalarWhereInputSchema';
import { CollectionTypeUpdateManyMutationInputSchema } from './CollectionTypeUpdateManyMutationInputSchema';
import { CollectionTypeUncheckedUpdateManyWithoutOrganizationInputSchema } from './CollectionTypeUncheckedUpdateManyWithoutOrganizationInputSchema';

export const CollectionTypeUpdateManyWithWhereWithoutOrganizationInputSchema: z.ZodType<Prisma.CollectionTypeUpdateManyWithWhereWithoutOrganizationInput> = z.object({
  where: z.lazy(() => CollectionTypeScalarWhereInputSchema),
  data: z.union([ z.lazy(() => CollectionTypeUpdateManyMutationInputSchema),z.lazy(() => CollectionTypeUncheckedUpdateManyWithoutOrganizationInputSchema) ]),
}).strict();

export default CollectionTypeUpdateManyWithWhereWithoutOrganizationInputSchema;
