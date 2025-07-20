import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateNestedOneWithoutUpvotesInputSchema } from './IssueCreateNestedOneWithoutUpvotesInputSchema';

export const UpvoteCreateWithoutUserInputSchema: z.ZodType<Prisma.UpvoteCreateWithoutUserInput> = z.object({
  id: z.string().cuid().optional(),
  createdAt: z.coerce.date().optional(),
  issue: z.lazy(() => IssueCreateNestedOneWithoutUpvotesInputSchema)
}).strict();

export default UpvoteCreateWithoutUserInputSchema;
