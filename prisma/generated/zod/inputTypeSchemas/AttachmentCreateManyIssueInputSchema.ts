import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const AttachmentCreateManyIssueInputSchema: z.ZodType<Prisma.AttachmentCreateManyIssueInput> = z.object({
  id: z.string().cuid().optional(),
  url: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  createdAt: z.coerce.date().optional(),
  organizationId: z.string()
}).strict();

export default AttachmentCreateManyIssueInputSchema;
