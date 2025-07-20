import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const AttachmentUncheckedCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.AttachmentUncheckedCreateWithoutOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  url: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  createdAt: z.coerce.date().optional(),
  issueId: z.string()
}).strict();

export default AttachmentUncheckedCreateWithoutOrganizationInputSchema;
