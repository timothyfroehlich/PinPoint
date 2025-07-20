import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const UpvoteCreateManyIssueInputSchema: z.ZodType<Prisma.UpvoteCreateManyIssueInput> = z.object({
  id: z.string().cuid().optional(),
  createdAt: z.coerce.date().optional(),
  userId: z.string()
}).strict();

export default UpvoteCreateManyIssueInputSchema;
