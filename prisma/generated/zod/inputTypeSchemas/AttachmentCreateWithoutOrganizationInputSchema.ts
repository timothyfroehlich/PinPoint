import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateNestedOneWithoutAttachmentsInputSchema } from './IssueCreateNestedOneWithoutAttachmentsInputSchema';

export const AttachmentCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.AttachmentCreateWithoutOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  url: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  createdAt: z.coerce.date().optional(),
  issue: z.lazy(() => IssueCreateNestedOneWithoutAttachmentsInputSchema)
}).strict();

export default AttachmentCreateWithoutOrganizationInputSchema;
