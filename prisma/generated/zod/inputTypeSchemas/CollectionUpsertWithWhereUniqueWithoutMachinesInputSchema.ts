import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';
import { CollectionUpdateWithoutMachinesInputSchema } from './CollectionUpdateWithoutMachinesInputSchema';
import { CollectionUncheckedUpdateWithoutMachinesInputSchema } from './CollectionUncheckedUpdateWithoutMachinesInputSchema';
import { CollectionCreateWithoutMachinesInputSchema } from './CollectionCreateWithoutMachinesInputSchema';
import { CollectionUncheckedCreateWithoutMachinesInputSchema } from './CollectionUncheckedCreateWithoutMachinesInputSchema';

export const CollectionUpsertWithWhereUniqueWithoutMachinesInputSchema: z.ZodType<Prisma.CollectionUpsertWithWhereUniqueWithoutMachinesInput> = z.object({
  where: z.lazy(() => CollectionWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => CollectionUpdateWithoutMachinesInputSchema),z.lazy(() => CollectionUncheckedUpdateWithoutMachinesInputSchema) ]),
  create: z.union([ z.lazy(() => CollectionCreateWithoutMachinesInputSchema),z.lazy(() => CollectionUncheckedCreateWithoutMachinesInputSchema) ]),
}).strict();

export default CollectionUpsertWithWhereUniqueWithoutMachinesInputSchema;
