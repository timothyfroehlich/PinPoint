import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionScalarWhereInputSchema } from './CollectionScalarWhereInputSchema';
import { CollectionUpdateManyMutationInputSchema } from './CollectionUpdateManyMutationInputSchema';
import { CollectionUncheckedUpdateManyWithoutMachinesInputSchema } from './CollectionUncheckedUpdateManyWithoutMachinesInputSchema';

export const CollectionUpdateManyWithWhereWithoutMachinesInputSchema: z.ZodType<Prisma.CollectionUpdateManyWithWhereWithoutMachinesInput> = z.object({
  where: z.lazy(() => CollectionScalarWhereInputSchema),
  data: z.union([ z.lazy(() => CollectionUpdateManyMutationInputSchema),z.lazy(() => CollectionUncheckedUpdateManyWithoutMachinesInputSchema) ]),
}).strict();

export default CollectionUpdateManyWithWhereWithoutMachinesInputSchema;
