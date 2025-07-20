import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { CollectionCreateWithoutMachinesInputSchema } from './CollectionCreateWithoutMachinesInputSchema';
import { CollectionUncheckedCreateWithoutMachinesInputSchema } from './CollectionUncheckedCreateWithoutMachinesInputSchema';
import { CollectionCreateOrConnectWithoutMachinesInputSchema } from './CollectionCreateOrConnectWithoutMachinesInputSchema';
import { CollectionWhereUniqueInputSchema } from './CollectionWhereUniqueInputSchema';

export const CollectionUncheckedCreateNestedManyWithoutMachinesInputSchema: z.ZodType<Prisma.CollectionUncheckedCreateNestedManyWithoutMachinesInput> = z.object({
  create: z.union([ z.lazy(() => CollectionCreateWithoutMachinesInputSchema),z.lazy(() => CollectionCreateWithoutMachinesInputSchema).array(),z.lazy(() => CollectionUncheckedCreateWithoutMachinesInputSchema),z.lazy(() => CollectionUncheckedCreateWithoutMachinesInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CollectionCreateOrConnectWithoutMachinesInputSchema),z.lazy(() => CollectionCreateOrConnectWithoutMachinesInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema),z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default CollectionUncheckedCreateNestedManyWithoutMachinesInputSchema;
