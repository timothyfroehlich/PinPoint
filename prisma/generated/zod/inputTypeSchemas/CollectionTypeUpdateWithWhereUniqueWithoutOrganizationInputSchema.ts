import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionTypeWhereUniqueInputSchema } from './CollectionTypeWhereUniqueInputSchema';
import { CollectionTypeUpdateWithoutOrganizationInputSchema } from './CollectionTypeUpdateWithoutOrganizationInputSchema';
import { CollectionTypeUncheckedUpdateWithoutOrganizationInputSchema } from './CollectionTypeUncheckedUpdateWithoutOrganizationInputSchema';

export const CollectionTypeUpdateWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.CollectionTypeUpdateWithWhereUniqueWithoutOrganizationInput> = z.object({
  where: z.lazy(() => CollectionTypeWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => CollectionTypeUpdateWithoutOrganizationInputSchema),z.lazy(() => CollectionTypeUncheckedUpdateWithoutOrganizationInputSchema) ]),
}).strict();

export default CollectionTypeUpdateWithWhereUniqueWithoutOrganizationInputSchema;
