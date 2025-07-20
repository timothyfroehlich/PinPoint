import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueUpdateWithoutMachineInputSchema } from './IssueUpdateWithoutMachineInputSchema';
import { IssueUncheckedUpdateWithoutMachineInputSchema } from './IssueUncheckedUpdateWithoutMachineInputSchema';

export const IssueUpdateWithWhereUniqueWithoutMachineInputSchema: z.ZodType<Prisma.IssueUpdateWithWhereUniqueWithoutMachineInput> = z.object({
  where: z.lazy(() => IssueWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => IssueUpdateWithoutMachineInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutMachineInputSchema) ]),
}).strict();

export default IssueUpdateWithWhereUniqueWithoutMachineInputSchema;
