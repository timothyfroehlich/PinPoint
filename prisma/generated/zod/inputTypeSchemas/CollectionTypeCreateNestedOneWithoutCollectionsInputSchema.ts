import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionTypeCreateWithoutCollectionsInputSchema } from './CollectionTypeCreateWithoutCollectionsInputSchema';
import { CollectionTypeUncheckedCreateWithoutCollectionsInputSchema } from './CollectionTypeUncheckedCreateWithoutCollectionsInputSchema';
import { CollectionTypeCreateOrConnectWithoutCollectionsInputSchema } from './CollectionTypeCreateOrConnectWithoutCollectionsInputSchema';
import { CollectionTypeWhereUniqueInputSchema } from './CollectionTypeWhereUniqueInputSchema';

export const CollectionTypeCreateNestedOneWithoutCollectionsInputSchema: z.ZodType<Prisma.CollectionTypeCreateNestedOneWithoutCollectionsInput> = z.object({
  create: z.union([ z.lazy(() => CollectionTypeCreateWithoutCollectionsInputSchema),z.lazy(() => CollectionTypeUncheckedCreateWithoutCollectionsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => CollectionTypeCreateOrConnectWithoutCollectionsInputSchema).optional(),
  connect: z.lazy(() => CollectionTypeWhereUniqueInputSchema).optional()
}).strict();

export default CollectionTypeCreateNestedOneWithoutCollectionsInputSchema;
