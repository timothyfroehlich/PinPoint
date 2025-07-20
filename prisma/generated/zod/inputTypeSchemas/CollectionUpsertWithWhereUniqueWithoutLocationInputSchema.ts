import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';
import { CollectionUpdateWithoutLocationInputSchema } from './CollectionUpdateWithoutLocationInputSchema';
import { CollectionUncheckedUpdateWithoutLocationInputSchema } from './CollectionUncheckedUpdateWithoutLocationInputSchema';
import { CollectionCreateWithoutLocationInputSchema } from './CollectionCreateWithoutLocationInputSchema';
import { CollectionUncheckedCreateWithoutLocationInputSchema } from './CollectionUncheckedCreateWithoutLocationInputSchema';

export const CollectionUpsertWithWhereUniqueWithoutLocationInputSchema: z.ZodType<Prisma.CollectionUpsertWithWhereUniqueWithoutLocationInput> = z.object({
  where: z.lazy(() => CollectionWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => CollectionUpdateWithoutLocationInputSchema),z.lazy(() => CollectionUncheckedUpdateWithoutLocationInputSchema) ]),
  create: z.union([ z.lazy(() => CollectionCreateWithoutLocationInputSchema),z.lazy(() => CollectionUncheckedCreateWithoutLocationInputSchema) ]),
}).strict();

export default CollectionUpsertWithWhereUniqueWithoutLocationInputSchema;
