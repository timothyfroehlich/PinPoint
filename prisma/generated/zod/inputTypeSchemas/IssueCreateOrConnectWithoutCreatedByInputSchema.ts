import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';
import { IssueCreateWithoutCreatedByInputSchema } from './IssueCreateWithoutCreatedByInputSchema';
import { IssueUncheckedCreateWithoutCreatedByInputSchema } from './IssueUncheckedCreateWithoutCreatedByInputSchema';

export const IssueCreateOrConnectWithoutCreatedByInputSchema: z.ZodType<Prisma.IssueCreateOrConnectWithoutCreatedByInput> = z.object({
  where: z.lazy(() => IssueWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => IssueCreateWithoutCreatedByInputSchema),z.lazy(() => IssueUncheckedCreateWithoutCreatedByInputSchema) ]),
}).strict();

export default IssueCreateOrConnectWithoutCreatedByInputSchema;
