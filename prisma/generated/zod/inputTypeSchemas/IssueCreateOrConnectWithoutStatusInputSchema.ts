import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueCreateWithoutStatusInputSchema } from './IssueCreateWithoutStatusInputSchema';
import { IssueUncheckedCreateWithoutStatusInputSchema } from './IssueUncheckedCreateWithoutStatusInputSchema';

export const IssueCreateOrConnectWithoutStatusInputSchema: z.ZodType<Prisma.IssueCreateOrConnectWithoutStatusInput> = z.object({
  where: z.lazy(() => IssueWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => IssueCreateWithoutStatusInputSchema),z.lazy(() => IssueUncheckedCreateWithoutStatusInputSchema) ]),
}).strict();

export default IssueCreateOrConnectWithoutStatusInputSchema;
