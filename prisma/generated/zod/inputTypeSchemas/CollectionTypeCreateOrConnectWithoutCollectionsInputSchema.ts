import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionTypeWhereUniqueInputSchema } from './CollectionTypeWhereUniqueInputSchema';
import { CollectionTypeCreateWithoutCollectionsInputSchema } from './CollectionTypeCreateWithoutCollectionsInputSchema';
import { CollectionTypeUncheckedCreateWithoutCollectionsInputSchema } from './CollectionTypeUncheckedCreateWithoutCollectionsInputSchema';

export const CollectionTypeCreateOrConnectWithoutCollectionsInputSchema: z.ZodType<Prisma.CollectionTypeCreateOrConnectWithoutCollectionsInput> = z.object({
  where: z.lazy(() => CollectionTypeWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => CollectionTypeCreateWithoutCollectionsInputSchema),z.lazy(() => CollectionTypeUncheckedCreateWithoutCollectionsInputSchema) ]),
}).strict();

export default CollectionTypeCreateOrConnectWithoutCollectionsInputSchema;
