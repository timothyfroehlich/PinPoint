import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { ModelCreateWithoutMachinesInputSchema } from './ModelCreateWithoutMachinesInputSchema';
import { ModelUncheckedCreateWithoutMachinesInputSchema } from './ModelUncheckedCreateWithoutMachinesInputSchema';
import { ModelCreateOrConnectWithoutMachinesInputSchema } from './ModelCreateOrConnectWithoutMachinesInputSchema';
import { ModelWhereUniqueInputSchema } from './ModelWhereUniqueInputSchema';

export const ModelCreateNestedOneWithoutMachinesInputSchema: z.ZodType<Prisma.ModelCreateNestedOneWithoutMachinesInput> = z.object({
  create: z.union([ z.lazy(() => ModelCreateWithoutMachinesInputSchema),z.lazy(() => ModelUncheckedCreateWithoutMachinesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => ModelCreateOrConnectWithoutMachinesInputSchema).optional(),
  connect: z.lazy(() => ModelWhereUniqueInputSchema).optional()
}).strict();

export default ModelCreateNestedOneWithoutMachinesInputSchema;
