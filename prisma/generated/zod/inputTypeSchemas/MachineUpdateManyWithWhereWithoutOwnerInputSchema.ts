import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineScalarWhereInputSchema } from './MachineScalarWhereInputSchema';
import { MachineUpdateManyMutationInputSchema } from './MachineUpdateManyMutationInputSchema';
import { MachineUncheckedUpdateManyWithoutOwnerInputSchema } from './MachineUncheckedUpdateManyWithoutOwnerInputSchema';

export const MachineUpdateManyWithWhereWithoutOwnerInputSchema: z.ZodType<Prisma.MachineUpdateManyWithWhereWithoutOwnerInput> = z.object({
  where: z.lazy(() => MachineScalarWhereInputSchema),
  data: z.union([ z.lazy(() => MachineUpdateManyMutationInputSchema),z.lazy(() => MachineUncheckedUpdateManyWithoutOwnerInputSchema) ]),
}).strict();

export default MachineUpdateManyWithWhereWithoutOwnerInputSchema;
