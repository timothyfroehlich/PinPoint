import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionCreateWithoutMachinesInputSchema } from './CollectionCreateWithoutMachinesInputSchema';
import { CollectionUncheckedCreateWithoutMachinesInputSchema } from './CollectionUncheckedCreateWithoutMachinesInputSchema';
import { CollectionCreateOrConnectWithoutMachinesInputSchema } from './CollectionCreateOrConnectWithoutMachinesInputSchema';
import { CollectionUpsertWithWhereUniqueWithoutMachinesInputSchema } from './CollectionUpsertWithWhereUniqueWithoutMachinesInputSchema';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';
import { CollectionUpdateWithWhereUniqueWithoutMachinesInputSchema } from './CollectionUpdateWithWhereUniqueWithoutMachinesInputSchema';
import { CollectionUpdateManyWithWhereWithoutMachinesInputSchema } from './CollectionUpdateManyWithWhereWithoutMachinesInputSchema';
import { CollectionScalarWhereInputSchema } from './CollectionScalarWhereInputSchema';

export const CollectionUncheckedUpdateManyWithoutMachinesNestedInputSchema: z.ZodType<Prisma.CollectionUncheckedUpdateManyWithoutMachinesNestedInput> = z.object({
  create: z.union([ z.lazy(() => CollectionCreateWithoutMachinesInputSchema),z.lazy(() => CollectionCreateWithoutMachinesInputSchema).array(),z.lazy(() => CollectionUncheckedCreateWithoutMachinesInputSchema),z.lazy(() => CollectionUncheckedCreateWithoutMachinesInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CollectionCreateOrConnectWithoutMachinesInputSchema),z.lazy(() => CollectionCreateOrConnectWithoutMachinesInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => CollectionUpsertWithWhereUniqueWithoutMachinesInputSchema),z.lazy(() => CollectionUpsertWithWhereUniqueWithoutMachinesInputSchema).array() ]).optional(),
  set: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => CollectionUpdateWithWhereUniqueWithoutMachinesInputSchema),z.lazy(() => CollectionUpdateWithWhereUniqueWithoutMachinesInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => CollectionUpdateManyWithWhereWithoutMachinesInputSchema),z.lazy(() => CollectionUpdateManyWithWhereWithoutMachinesInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => CollectionScalarWhereInputSchema),z.lazy(() => CollectionScalarWhereInputSchema).array() ]).optional(),
}).strict();

export default CollectionUncheckedUpdateManyWithoutMachinesNestedInputSchema;
