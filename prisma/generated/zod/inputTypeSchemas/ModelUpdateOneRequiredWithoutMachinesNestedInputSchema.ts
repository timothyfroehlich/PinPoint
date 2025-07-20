import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { ModelCreateWithoutMachinesInputSchema } from './ModelCreateWithoutMachinesInputSchema';
import { ModelUncheckedCreateWithoutMachinesInputSchema } from './ModelUncheckedCreateWithoutMachinesInputSchema';
import { ModelCreateOrConnectWithoutMachinesInputSchema } from './ModelCreateOrConnectWithoutMachinesInputSchema';
import { ModelUpsertWithoutMachinesInputSchema } from './ModelUpsertWithoutMachinesInputSchema';
import { ModelWhereUniqueInputSchema } from './ModelWhereUniqueInputSchema';
import { ModelUpdateToOneWithWhereWithoutMachinesInputSchema } from './ModelUpdateToOneWithWhereWithoutMachinesInputSchema';
import { ModelUpdateWithoutMachinesInputSchema } from './ModelUpdateWithoutMachinesInputSchema';
import { ModelUncheckedUpdateWithoutMachinesInputSchema } from './ModelUncheckedUpdateWithoutMachinesInputSchema';

export const ModelUpdateOneRequiredWithoutMachinesNestedInputSchema: z.ZodType<Prisma.ModelUpdateOneRequiredWithoutMachinesNestedInput> = z.object({
  create: z.union([ z.lazy(() => ModelCreateWithoutMachinesInputSchema),z.lazy(() => ModelUncheckedCreateWithoutMachinesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => ModelCreateOrConnectWithoutMachinesInputSchema).optional(),
  upsert: z.lazy(() => ModelUpsertWithoutMachinesInputSchema).optional(),
  connect: z.lazy(() => ModelWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => ModelUpdateToOneWithWhereWithoutMachinesInputSchema),z.lazy(() => ModelUpdateWithoutMachinesInputSchema),z.lazy(() => ModelUncheckedUpdateWithoutMachinesInputSchema) ]).optional(),
}).strict();

export default ModelUpdateOneRequiredWithoutMachinesNestedInputSchema;
