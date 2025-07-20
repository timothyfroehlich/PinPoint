import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionCreateWithoutLocationInputSchema } from './CollectionCreateWithoutLocationInputSchema';
import { CollectionUncheckedCreateWithoutLocationInputSchema } from './CollectionUncheckedCreateWithoutLocationInputSchema';
import { CollectionCreateOrConnectWithoutLocationInputSchema } from './CollectionCreateOrConnectWithoutLocationInputSchema';
import { CollectionCreateManyLocationInputEnvelopeSchema } from './CollectionCreateManyLocationInputEnvelopeSchema';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';

export const CollectionUncheckedCreateNestedManyWithoutLocationInputSchema: z.ZodType<Prisma.CollectionUncheckedCreateNestedManyWithoutLocationInput> = z.object({
  create: z.union([ z.lazy(() => CollectionCreateWithoutLocationInputSchema),z.lazy(() => CollectionCreateWithoutLocationInputSchema).array(),z.lazy(() => CollectionUncheckedCreateWithoutLocationInputSchema),z.lazy(() => CollectionUncheckedCreateWithoutLocationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CollectionCreateOrConnectWithoutLocationInputSchema),z.lazy(() => CollectionCreateOrConnectWithoutLocationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CollectionCreateManyLocationInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default CollectionUncheckedCreateNestedManyWithoutLocationInputSchema;
