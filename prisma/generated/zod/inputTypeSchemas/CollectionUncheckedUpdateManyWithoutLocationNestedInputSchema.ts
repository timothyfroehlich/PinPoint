import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionCreateWithoutLocationInputSchema } from './CollectionCreateWithoutLocationInputSchema';
import { CollectionUncheckedCreateWithoutLocationInputSchema } from './CollectionUncheckedCreateWithoutLocationInputSchema';
import { CollectionCreateOrConnectWithoutLocationInputSchema } from './CollectionCreateOrConnectWithoutLocationInputSchema';
import { CollectionUpsertWithWhereUniqueWithoutLocationInputSchema } from './CollectionUpsertWithWhereUniqueWithoutLocationInputSchema';
import { CollectionCreateManyLocationInputEnvelopeSchema } from './CollectionCreateManyLocationInputEnvelopeSchema';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';
import { CollectionUpdateWithWhereUniqueWithoutLocationInputSchema } from './CollectionUpdateWithWhereUniqueWithoutLocationInputSchema';
import { CollectionUpdateManyWithWhereWithoutLocationInputSchema } from './CollectionUpdateManyWithWhereWithoutLocationInputSchema';
import { CollectionScalarWhereInputSchema } from './CollectionScalarWhereInputSchema';

export const CollectionUncheckedUpdateManyWithoutLocationNestedInputSchema: z.ZodType<Prisma.CollectionUncheckedUpdateManyWithoutLocationNestedInput> = z.object({
  create: z.union([ z.lazy(() => CollectionCreateWithoutLocationInputSchema),z.lazy(() => CollectionCreateWithoutLocationInputSchema).array(),z.lazy(() => CollectionUncheckedCreateWithoutLocationInputSchema),z.lazy(() => CollectionUncheckedCreateWithoutLocationInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CollectionCreateOrConnectWithoutLocationInputSchema),z.lazy(() => CollectionCreateOrConnectWithoutLocationInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => CollectionUpsertWithWhereUniqueWithoutLocationInputSchema),z.lazy(() => CollectionUpsertWithWhereUniqueWithoutLocationInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CollectionCreateManyLocationInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => CollectionUpdateWithWhereUniqueWithoutLocationInputSchema),z.lazy(() => CollectionUpdateWithWhereUniqueWithoutLocationInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => CollectionUpdateManyWithWhereWithoutLocationInputSchema),z.lazy(() => CollectionUpdateManyWithWhereWithoutLocationInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => CollectionScalarWhereInputSchema),z.lazy(() => CollectionScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default CollectionUncheckedUpdateManyWithoutLocationNestedInputSchema;
