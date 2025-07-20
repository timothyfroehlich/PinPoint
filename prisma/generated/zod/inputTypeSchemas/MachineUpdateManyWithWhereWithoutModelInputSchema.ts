import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineScalarWhereInputSchema } from './MachineScalarWhereInputSchema';
import { MachineUpdateManyMutationInputSchema } from './MachineUpdateManyMutationInputSchema';
import { MachineUncheckedUpdateManyWithoutModelInputSchema } from './MachineUncheckedUpdateManyWithoutModelInputSchema';

export const MachineUpdateManyWithWhereWithoutModelInputSchema: z.ZodType<Prisma.MachineUpdateManyWithWhereWithoutModelInput> = z.object({
  where: z.lazy(() => MachineScalarWhereInputSchema),
  data: z.union([ z.lazy(() => MachineUpdateManyMutationInputSchema),z.lazy(() => MachineUncheckedUpdateManyWithoutModelInputSchema) ]),
}).strict();

export default MachineUpdateManyWithWhereWithoutModelInputSchema;
