import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionCreateWithoutTypeInputSchema } from './CollectionCreateWithoutTypeInputSchema';
import { CollectionUncheckedCreateWithoutTypeInputSchema } from './CollectionUncheckedCreateWithoutTypeInputSchema';
import { CollectionCreateOrConnectWithoutTypeInputSchema } from './CollectionCreateOrConnectWithoutTypeInputSchema';
import { CollectionCreateManyTypeInputEnvelopeSchema } from './CollectionCreateManyTypeInputEnvelopeSchema';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';

export const CollectionUncheckedCreateNestedManyWithoutTypeInputSchema: z.ZodType<Prisma.CollectionUncheckedCreateNestedManyWithoutTypeInput> = z.object({
  create: z.union([ z.lazy(() => CollectionCreateWithoutTypeInputSchema),z.lazy(() => CollectionCreateWithoutTypeInputSchema).array(),z.lazy(() => CollectionUncheckedCreateWithoutTypeInputSchema),z.lazy(() => CollectionUncheckedCreateWithoutTypeInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CollectionCreateOrConnectWithoutTypeInputSchema),z.lazy(() => CollectionCreateOrConnectWithoutTypeInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CollectionCreateManyTypeInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default CollectionUncheckedCreateNestedManyWithoutTypeInputSchema;
