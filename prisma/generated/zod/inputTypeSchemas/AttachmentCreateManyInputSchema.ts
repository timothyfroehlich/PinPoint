import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const AttachmentCreateManyInputSchema: z.ZodType<Prisma.AttachmentCreateManyInput> = z.object({
  id: z.string().cuid().optional(),
  url: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  createdAt: z.coerce.date().optional(),
  organizationId: z.string(),
  issueId: z.string()
}).strict();

export default AttachmentCreateManyInputSchema;
