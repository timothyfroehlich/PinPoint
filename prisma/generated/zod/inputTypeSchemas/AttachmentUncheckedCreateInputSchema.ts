import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const AttachmentUncheckedCreateInputSchema: z.ZodType<Prisma.AttachmentUncheckedCreateInput> = z.object({
  id: z.string().cuid().optional(),
  url: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  createdAt: z.coerce.date().optional(),
  organizationId: z.string(),
  issueId: z.string()
}).strict();

export default AttachmentUncheckedCreateInputSchema;
