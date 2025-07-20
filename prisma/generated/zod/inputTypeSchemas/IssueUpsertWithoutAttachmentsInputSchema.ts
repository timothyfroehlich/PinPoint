import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueUpdateWithoutAttachmentsInputSchema } from './IssueUpdateWithoutAttachmentsInputSchema';
import { IssueUncheckedUpdateWithoutAttachmentsInputSchema } from './IssueUncheckedUpdateWithoutAttachmentsInputSchema';
import { IssueCreateWithoutAttachmentsInputSchema } from './IssueCreateWithoutAttachmentsInputSchema';
import { IssueUncheckedCreateWithoutAttachmentsInputSchema } from './IssueUncheckedCreateWithoutAttachmentsInputSchema';
import { IssueWhereInputSchema } from './IssueWhereInputSchema';

export const IssueUpsertWithoutAttachmentsInputSchema: z.ZodType<Prisma.IssueUpsertWithoutAttachmentsInput> = z.object({
  update: z.union([ z.lazy(() => IssueUpdateWithoutAttachmentsInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutAttachmentsInputSchema) ]),
  create: z.union([ z.lazy(() => IssueCreateWithoutAttachmentsInputSchema),z.lazy(() => IssueUncheckedCreateWithoutAttachmentsInputSchema) ]),
  where: z.lazy(() => IssueWhereInputSchema).optional()
}).strict();

export default IssueUpsertWithoutAttachmentsInputSchema;
