import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { ModelUpdateWithoutMachinesInputSchema } from './ModelUpdateWithoutMachinesInputSchema';
import { ModelUncheckedUpdateWithoutMachinesInputSchema } from './ModelUncheckedUpdateWithoutMachinesInputSchema';
import { ModelCreateWithoutMachinesInputSchema } from './ModelCreateWithoutMachinesInputSchema';
import { ModelUncheckedCreateWithoutMachinesInputSchema } from './ModelUncheckedCreateWithoutMachinesInputSchema';
import { ModelWhereInputSchema } from './ModelWhereInputSchema';

export const ModelUpsertWithoutMachinesInputSchema: z.ZodType<Prisma.ModelUpsertWithoutMachinesInput> = z.object({
  update: z.union([ z.lazy(() => ModelUpdateWithoutMachinesInputSchema),z.lazy(() => ModelUncheckedUpdateWithoutMachinesInputSchema) ]),
  create: z.union([ z.lazy(() => ModelCreateWithoutMachinesInputSchema),z.lazy(() => ModelUncheckedCreateWithoutMachinesInputSchema) ]),
  where: z.lazy(() => ModelWhereInputSchema).optional()
}).strict();

export default ModelUpsertWithoutMachinesInputSchema;
