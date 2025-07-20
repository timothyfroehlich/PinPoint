import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineWhereInputSchema } from './MachineWhereInputSchema';
import { MachineUpdateWithoutIssuesInputSchema } from './MachineUpdateWithoutIssuesInputSchema';
import { MachineUncheckedUpdateWithoutIssuesInputSchema } from './MachineUncheckedUpdateWithoutIssuesInputSchema';

export const MachineUpdateToOneWithWhereWithoutIssuesInputSchema: z.ZodType<Prisma.MachineUpdateToOneWithWhereWithoutIssuesInput> = z.object({
  where: z.lazy(() => MachineWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => MachineUpdateWithoutIssuesInputSchema),z.lazy(() => MachineUncheckedUpdateWithoutIssuesInputSchema) ]),
}).strict();

export default MachineUpdateToOneWithWhereWithoutIssuesInputSchema;
