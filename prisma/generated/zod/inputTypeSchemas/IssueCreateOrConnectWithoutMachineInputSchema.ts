import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueCreateWithoutMachineInputSchema } from './IssueCreateWithoutMachineInputSchema';
import { IssueUncheckedCreateWithoutMachineInputSchema } from './IssueUncheckedCreateWithoutMachineInputSchema';

export const IssueCreateOrConnectWithoutMachineInputSchema: z.ZodType<Prisma.IssueCreateOrConnectWithoutMachineInput> = z.object({
  where: z.lazy(() => IssueWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => IssueCreateWithoutMachineInputSchema),z.lazy(() => IssueUncheckedCreateWithoutMachineInputSchema) ]),
}).strict();

export default IssueCreateOrConnectWithoutMachineInputSchema;
