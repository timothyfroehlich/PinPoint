import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionTypeWhereInputSchema } from './CollectionTypeWhereInputSchema';
import { CollectionTypeUpdateWithoutCollectionsInputSchema } from './CollectionTypeUpdateWithoutCollectionsInputSchema';
import { CollectionTypeUncheckedUpdateWithoutCollectionsInputSchema } from './CollectionTypeUncheckedUpdateWithoutCollectionsInputSchema';

export const CollectionTypeUpdateToOneWithWhereWithoutCollectionsInputSchema: z.ZodType<Prisma.CollectionTypeUpdateToOneWithWhereWithoutCollectionsInput> = z.object({
  where: z.lazy(() => CollectionTypeWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => CollectionTypeUpdateWithoutCollectionsInputSchema),z.lazy(() => CollectionTypeUncheckedUpdateWithoutCollectionsInputSchema) ]),
}).strict();

export default CollectionTypeUpdateToOneWithWhereWithoutCollectionsInputSchema;
