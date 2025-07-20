import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueCreateNestedOneWithoutUpvotesInputSchema } from './IssueCreateNestedOneWithoutUpvotesInputSchema';
import { UserCreateNestedOneWithoutUpvotesInputSchema } from './UserCreateNestedOneWithoutUpvotesInputSchema';

export const UpvoteCreateInputSchema: z.ZodType<Prisma.UpvoteCreateInput> = z.object({
  id: z.string().cuid().optional(),
  createdAt: z.coerce.date().optional(),
  issue: z.lazy(() => IssueCreateNestedOneWithoutUpvotesInputSchema),
  user: z.lazy(() => UserCreateNestedOneWithoutUpvotesInputSchema)
}).strict();

export default UpvoteCreateInputSchema;
