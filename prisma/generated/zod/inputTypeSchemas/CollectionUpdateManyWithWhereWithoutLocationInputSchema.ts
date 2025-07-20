import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionScalarWhereInputSchema } from './CollectionScalarWhereInputSchema';
import { CollectionUpdateManyMutationInputSchema } from './CollectionUpdateManyMutationInputSchema';
import { CollectionUncheckedUpdateManyWithoutLocationInputSchema } from './CollectionUncheckedUpdateManyWithoutLocationInputSchema';

export const CollectionUpdateManyWithWhereWithoutLocationInputSchema: z.ZodType<Prisma.CollectionUpdateManyWithWhereWithoutLocationInput> = z.object({
  where: z.lazy(() => CollectionScalarWhereInputSchema),
  data: z.union([ z.lazy(() => CollectionUpdateManyMutationInputSchema),z.lazy(() => CollectionUncheckedUpdateManyWithoutLocationInputSchema) ]),
}).strict();

export default CollectionUpdateManyWithWhereWithoutLocationInputSchema;
