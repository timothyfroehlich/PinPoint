import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateWithoutAttachmentsInputSchema } from './IssueCreateWithoutAttachmentsInputSchema';
import { IssueUncheckedCreateWithoutAttachmentsInputSchema } from './IssueUncheckedCreateWithoutAttachmentsInputSchema';
import { IssueCreateOrConnectWithoutAttachmentsInputSchema } from './IssueCreateOrConnectWithoutAttachmentsInputSchema';
import { IssueWhereUniqueInputSchema } from './IssueWhereUniqueInputSchema';

export const IssueCreateNestedOneWithoutAttachmentsInputSchema: z.ZodType<Prisma.IssueCreateNestedOneWithoutAttachmentsInput> = z.object({
  create: z.union([ z.lazy(() => IssueCreateWithoutAttachmentsInputSchema),z.lazy(() => IssueUncheckedCreateWithoutAttachmentsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => IssueCreateOrConnectWithoutAttachmentsInputSchema).optional(),
  connect: z.lazy(() => IssueWhereUniqueInputSchema).optional()
}).strict();

export default IssueCreateNestedOneWithoutAttachmentsInputSchema;
