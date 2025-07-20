import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionTypeUpdateWithoutCollectionsInputSchema } from './CollectionTypeUpdateWithoutCollectionsInputSchema';
import { CollectionTypeUncheckedUpdateWithoutCollectionsInputSchema } from './CollectionTypeUncheckedUpdateWithoutCollectionsInputSchema';
import { CollectionTypeCreateWithoutCollectionsInputSchema } from './CollectionTypeCreateWithoutCollectionsInputSchema';
import { CollectionTypeUncheckedCreateWithoutCollectionsInputSchema } from './CollectionTypeUncheckedCreateWithoutCollectionsInputSchema';
import { CollectionTypeWhereInputSchema } from './CollectionTypeWhereInputSchema';

export const CollectionTypeUpsertWithoutCollectionsInputSchema: z.ZodType<Prisma.CollectionTypeUpsertWithoutCollectionsInput> = z.object({
  update: z.union([ z.lazy(() => CollectionTypeUpdateWithoutCollectionsInputSchema),z.lazy(() => CollectionTypeUncheckedUpdateWithoutCollectionsInputSchema) ]),
  create: z.union([ z.lazy(() => CollectionTypeCreateWithoutCollectionsInputSchema),z.lazy(() => CollectionTypeUncheckedCreateWithoutCollectionsInputSchema) ]),
  where: z.lazy(() => CollectionTypeWhereInputSchema).optional()
}).strict();

export default CollectionTypeUpsertWithoutCollectionsInputSchema;
