import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MachineUpdateWithoutIssuesInputSchema } from './MachineUpdateWithoutIssuesInputSchema';
import { MachineUncheckedUpdateWithoutIssuesInputSchema } from './MachineUncheckedUpdateWithoutIssuesInputSchema';
import { MachineCreateWithoutIssuesInputSchema } from './MachineCreateWithoutIssuesInputSchema';
import { MachineUncheckedCreateWithoutIssuesInputSchema } from './MachineUncheckedCreateWithoutIssuesInputSchema';
import { MachineWhereInputSchema } from './MachineWhereInputSchema';

export const MachineUpsertWithoutIssuesInputSchema: z.ZodType<Prisma.MachineUpsertWithoutIssuesInput> = z.object({
  update: z.union([ z.lazy(() => MachineUpdateWithoutIssuesInputSchema),z.lazy(() => MachineUncheckedUpdateWithoutIssuesInputSchema) ]),
  create: z.union([ z.lazy(() => MachineCreateWithoutIssuesInputSchema),z.lazy(() => MachineUncheckedCreateWithoutIssuesInputSchema) ]),
  where: z.lazy(() => MachineWhereInputSchema).optional()
}).strict();

export default MachineUpsertWithoutIssuesInputSchema;
