import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';
import { CollectionCreateWithoutLocationInputSchema } from './CollectionCreateWithoutLocationInputSchema';
import { CollectionUncheckedCreateWithoutLocationInputSchema } from './CollectionUncheckedCreateWithoutLocationInputSchema';

export const CollectionCreateOrConnectWithoutLocationInputSchema: z.ZodType<Prisma.CollectionCreateOrConnectWithoutLocationInput> = z.object({
  where: z.lazy(() => CollectionWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => CollectionCreateWithoutLocationInputSchema),z.lazy(() => CollectionUncheckedCreateWithoutLocationInputSchema) ]),
}).strict();

export default CollectionCreateOrConnectWithoutLocationInputSchema;
