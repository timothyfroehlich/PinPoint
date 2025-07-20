import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueCreateWithoutAssignedToInputSchema } from './IssueCreateWithoutAssignedToInputSchema';
import { IssueUncheckedCreateWithoutAssignedToInputSchema } from './IssueUncheckedCreateWithoutAssignedToInputSchema';

export const IssueCreateOrConnectWithoutAssignedToInputSchema: z.ZodType<Prisma.IssueCreateOrConnectWithoutAssignedToInput> = z.object({
  where: z.lazy(() => IssueWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => IssueCreateWithoutAssignedToInputSchema),z.lazy(() => IssueUncheckedCreateWithoutAssignedToInputSchema) ]),
}).strict();

export default IssueCreateOrConnectWithoutAssignedToInputSchema;
