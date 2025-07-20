import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';
import { CollectionCreateWithoutMachinesInputSchema } from './CollectionCreateWithoutMachinesInputSchema';
import { CollectionUncheckedCreateWithoutMachinesInputSchema } from './CollectionUncheckedCreateWithoutMachinesInputSchema';

export const CollectionCreateOrConnectWithoutMachinesInputSchema: z.ZodType<Prisma.CollectionCreateOrConnectWithoutMachinesInput> = z.object({
  where: z.lazy(() => CollectionWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => CollectionCreateWithoutMachinesInputSchema),z.lazy(() => CollectionUncheckedCreateWithoutMachinesInputSchema) ]),
}).strict();

export default CollectionCreateOrConnectWithoutMachinesInputSchema;
