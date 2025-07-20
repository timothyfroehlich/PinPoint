import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const UpvoteIssueIdUserIdCompoundUniqueInputSchema: z.ZodType<Prisma.UpvoteIssueIdUserIdCompoundUniqueInput> = z.object({
  issueId: z.string(),
  userId: z.string()
}).strict();

export default UpvoteIssueIdUserIdCompoundUniqueInputSchema;
