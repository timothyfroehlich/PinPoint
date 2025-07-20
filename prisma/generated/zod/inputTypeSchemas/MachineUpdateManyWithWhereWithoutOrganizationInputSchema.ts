import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineScalarWhereInputSchema } from './MachineScalarWhereInputSchema';
import { MachineUpdateManyMutationInputSchema } from './MachineUpdateManyMutationInputSchema';
import { MachineUncheckedUpdateManyWithoutOrganizationInputSchema } from './MachineUncheckedUpdateManyWithoutOrganizationInputSchema';

export const MachineUpdateManyWithWhereWithoutOrganizationInputSchema: z.ZodType<Prisma.MachineUpdateManyWithWhereWithoutOrganizationInput> = z.object({
  where: z.lazy(() => MachineScalarWhereInputSchema),
  data: z.union([ z.lazy(() => MachineUpdateManyMutationInputSchema),z.lazy(() => MachineUncheckedUpdateManyWithoutOrganizationInputSchema) ]),
}).strict();

export default MachineUpdateManyWithWhereWithoutOrganizationInputSchema;
