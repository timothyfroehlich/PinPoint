import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { DateTimeFilterSchema } from './DateTimeFilterSchema';
import { IssueScalarRelationFilterSchema } from './IssueScalarRelationFilterSchema';
import { IssueWhereInputSchema } from './IssueWhereInputSchema';
import { UserScalarRelationFilterSchema } from './UserScalarRelationFilterSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';

export const UpvoteWhereInputSchema: z.ZodType<Prisma.UpvoteWhereInput> = z.object({
  AND: z.union([ z.lazy(() => UpvoteWhereInputSchema),z.lazy(() => UpvoteWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => UpvoteWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UpvoteWhereInputSchema),z.lazy(() => UpvoteWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  issueId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  issue: z.union([ z.lazy(() => IssueScalarRelationFilterSchema),z.lazy(() => IssueWhereInputSchema) ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema),z.lazy(() => UserWhereInputSchema) ]).optional(),
}).strict();

export default UpvoteWhereInputSchema;
