import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionCreateWithoutTypeInputSchema } from './CollectionCreateWithoutTypeInputSchema';
import { CollectionUncheckedCreateWithoutTypeInputSchema } from './CollectionUncheckedCreateWithoutTypeInputSchema';
import { CollectionCreateOrConnectWithoutTypeInputSchema } from './CollectionCreateOrConnectWithoutTypeInputSchema';
import { CollectionUpsertWithWhereUniqueWithoutTypeInputSchema } from './CollectionUpsertWithWhereUniqueWithoutTypeInputSchema';
import { CollectionCreateManyTypeInputEnvelopeSchema } from './CollectionCreateManyTypeInputEnvelopeSchema';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';
import { CollectionUpdateWithWhereUniqueWithoutTypeInputSchema } from './CollectionUpdateWithWhereUniqueWithoutTypeInputSchema';
import { CollectionUpdateManyWithWhereWithoutTypeInputSchema } from './CollectionUpdateManyWithWhereWithoutTypeInputSchema';
import { CollectionScalarWhereInputSchema } from './CollectionScalarWhereInputSchema';

export const CollectionUpdateManyWithoutTypeNestedInputSchema: z.ZodType<Prisma.CollectionUpdateManyWithoutTypeNestedInput> = z.object({
  create: z.union([ z.lazy(() => CollectionCreateWithoutTypeInputSchema),z.lazy(() => CollectionCreateWithoutTypeInputSchema).array(),z.lazy(() => CollectionUncheckedCreateWithoutTypeInputSchema),z.lazy(() => CollectionUncheckedCreateWithoutTypeInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CollectionCreateOrConnectWithoutTypeInputSchema),z.lazy(() => CollectionCreateOrConnectWithoutTypeInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => CollectionUpsertWithWhereUniqueWithoutTypeInputSchema),z.lazy(() => CollectionUpsertWithWhereUniqueWithoutTypeInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CollectionCreateManyTypeInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => CollectionUpdateWithWhereUniqueWithoutTypeInputSchema),z.lazy(() => CollectionUpdateWithWhereUniqueWithoutTypeInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => CollectionUpdateManyWithWhereWithoutTypeInputSchema),z.lazy(() => CollectionUpdateManyWithWhereWithoutTypeInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => CollectionScalarWhereInputSchema),z.lazy(() => CollectionScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default CollectionUpdateManyWithoutTypeNestedInputSchema;
