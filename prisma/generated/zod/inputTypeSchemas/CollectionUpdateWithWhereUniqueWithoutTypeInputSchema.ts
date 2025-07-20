import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';
import { CollectionUpdateWithoutTypeInputSchema } from './CollectionUpdateWithoutTypeInputSchema';
import { CollectionUncheckedUpdateWithoutTypeInputSchema } from './CollectionUncheckedUpdateWithoutTypeInputSchema';

export const CollectionUpdateWithWhereUniqueWithoutTypeInputSchema: z.ZodType<Prisma.CollectionUpdateWithWhereUniqueWithoutTypeInput> = z.object({
  where: z.lazy(() => CollectionWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => CollectionUpdateWithoutTypeInputSchema),z.lazy(() => CollectionUncheckedUpdateWithoutTypeInputSchema) ]),
}).strict();

export default CollectionUpdateWithWhereUniqueWithoutTypeInputSchema;
