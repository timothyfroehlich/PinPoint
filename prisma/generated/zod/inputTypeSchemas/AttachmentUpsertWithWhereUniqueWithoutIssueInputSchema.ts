import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { AttachmentWhereUniqueInputSchema } from './AttachmentWhereUniqueInputSchema';
import { AttachmentUpdateWithoutIssueInputSchema } from './AttachmentUpdateWithoutIssueInputSchema';
import { AttachmentUncheckedUpdateWithoutIssueInputSchema } from './AttachmentUncheckedUpdateWithoutIssueInputSchema';
import { AttachmentCreateWithoutIssueInputSchema } from './AttachmentCreateWithoutIssueInputSchema';
import { AttachmentUncheckedCreateWithoutIssueInputSchema } from './AttachmentUncheckedCreateWithoutIssueInputSchema';

export const AttachmentUpsertWithWhereUniqueWithoutIssueInputSchema: z.ZodType<Prisma.AttachmentUpsertWithWhereUniqueWithoutIssueInput> = z.object({
  where: z.lazy(() => AttachmentWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => AttachmentUpdateWithoutIssueInputSchema),z.lazy(() => AttachmentUncheckedUpdateWithoutIssueInputSchema) ]),
  create: z.union([ z.lazy(() => AttachmentCreateWithoutIssueInputSchema),z.lazy(() => AttachmentUncheckedCreateWithoutIssueInputSchema) ]),
}).strict();

export default AttachmentUpsertWithWhereUniqueWithoutIssueInputSchema;
