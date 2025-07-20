import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueWhereInputSchema } from './IssueWhereInputSchema';
import { IssueUpdateWithoutAttachmentsInputSchema } from './IssueUpdateWithoutAttachmentsInputSchema';
import { IssueUncheckedUpdateWithoutAttachmentsInputSchema } from './IssueUncheckedUpdateWithoutAttachmentsInputSchema';

export const IssueUpdateToOneWithWhereWithoutAttachmentsInputSchema: z.ZodType<Prisma.IssueUpdateToOneWithWhereWithoutAttachmentsInput> = z.object({
  where: z.lazy(() => IssueWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => IssueUpdateWithoutAttachmentsInputSchema),z.lazy(() => IssueUncheckedUpdateWithoutAttachmentsInputSchema) ]),
}).strict();

export default IssueUpdateToOneWithWhereWithoutAttachmentsInputSchema;
