import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionScalarWhereInputSchema } from './CollectionScalarWhereInputSchema';
import { CollectionUpdateManyMutationInputSchema } from './CollectionUpdateManyMutationInputSchema';
import { CollectionUncheckedUpdateManyWithoutTypeInputSchema } from './CollectionUncheckedUpdateManyWithoutTypeInputSchema';

export const CollectionUpdateManyWithWhereWithoutTypeInputSchema: z.ZodType<Prisma.CollectionUpdateManyWithWhereWithoutTypeInput> = z.object({
  where: z.lazy(() => CollectionScalarWhereInputSchema),
  data: z.union([ z.lazy(() => CollectionUpdateManyMutationInputSchema),z.lazy(() => CollectionUncheckedUpdateManyWithoutTypeInputSchema) ]),
}).strict();

export default CollectionUpdateManyWithWhereWithoutTypeInputSchema;
