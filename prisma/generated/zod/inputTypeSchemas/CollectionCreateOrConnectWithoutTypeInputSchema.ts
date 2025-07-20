import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';
import { CollectionCreateWithoutTypeInputSchema } from './CollectionCreateWithoutTypeInputSchema';
import { CollectionUncheckedCreateWithoutTypeInputSchema } from './CollectionUncheckedCreateWithoutTypeInputSchema';

export const CollectionCreateOrConnectWithoutTypeInputSchema: z.ZodType<Prisma.CollectionCreateOrConnectWithoutTypeInput> = z.object({
  where: z.lazy(() => CollectionWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => CollectionCreateWithoutTypeInputSchema),z.lazy(() => CollectionUncheckedCreateWithoutTypeInputSchema) ]),
}).strict();

export default CollectionCreateOrConnectWithoutTypeInputSchema;
