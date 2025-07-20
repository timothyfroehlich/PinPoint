import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { AttachmentCreateWithoutIssueInputSchema } from './AttachmentCreateWithoutIssueInputSchema';
import { AttachmentUncheckedCreateWithoutIssueInputSchema } from './AttachmentUncheckedCreateWithoutIssueInputSchema';
import { AttachmentCreateOrConnectWithoutIssueInputSchema } from './AttachmentCreateOrConnectWithoutIssueInputSchema';
import { AttachmentCreateManyIssueInputEnvelopeSchema } from './AttachmentCreateManyIssueInputEnvelopeSchema';
import { AttachmentWhereUniqueInputSchema } from './AttachmentWhereUniqueInputSchema';

export const AttachmentCreateNestedManyWithoutIssueInputSchema: z.ZodType<Prisma.AttachmentCreateNestedManyWithoutIssueInput> = z.object({
  create: z.union([ z.lazy(() => AttachmentCreateWithoutIssueInputSchema),z.lazy(() => AttachmentCreateWithoutIssueInputSchema).array(),z.lazy(() => AttachmentUncheckedCreateWithoutIssueInputSchema),z.lazy(() => AttachmentUncheckedCreateWithoutIssueInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => AttachmentCreateOrConnectWithoutIssueInputSchema),z.lazy(() => AttachmentCreateOrConnectWithoutIssueInputSchema).array() ]).optional(),
  createMany: z.lazy(() => AttachmentCreateManyIssueInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => AttachmentWhereUniqueInputSchema),z.lazy(() => AttachmentWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default AttachmentCreateNestedManyWithoutIssueInputSchema;
