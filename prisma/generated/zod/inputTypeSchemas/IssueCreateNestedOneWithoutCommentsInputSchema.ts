import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateWithoutCommentsInputSchema } from './IssueCreateWithoutCommentsInputSchema';
import { IssueUncheckedCreateWithoutCommentsInputSchema } from './IssueUncheckedCreateWithoutCommentsInputSchema';
import { IssueCreateOrConnectWithoutCommentsInputSchema } from './IssueCreateOrConnectWithoutCommentsInputSchema';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';

export const IssueCreateNestedOneWithoutCommentsInputSchema: z.ZodType<Prisma.IssueCreateNestedOneWithoutCommentsInput> = z.object({
  create: z.union([ z.lazy(() => IssueCreateWithoutCommentsInputSchema),z.lazy(() => IssueUncheckedCreateWithoutCommentsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => IssueCreateOrConnectWithoutCommentsInputSchema).optional(),
  connect: z.lazy(() => IssueWhereUniqueInputSchema).optional()
}).strict();

export default IssueCreateNestedOneWithoutCommentsInputSchema;
