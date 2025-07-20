import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UpvoteIssueIdUserIdCompoundUniqueInputSchema } from './UpvoteIssueIdUserIdCompoundUniqueInputSchema';
import { UpvoteWhereInputSchema } from './UpvoteWhereInputSchema';
import { DateTimeFilterSchema } from './DateTimeFilterSchema';
import { StringFilterSchema } from './StringFilterSchema';
import { IssueScalarRelationFilterSchema } from './IssueScalarRelationFilterSchema';
import { IssueWhereInputSchema } from './IssueWhereInputSchema';
import { UserScalarRelationFilterSchema } from './UserScalarRelationFilterSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';

export const UpvoteWhereUniqueInputSchema: z.ZodType<Prisma.UpvoteWhereUniqueInput> = z.union([
  z.object({
    id: z.string().cuid(),
    issueId_userId: z.lazy(() => UpvoteIssueIdUserIdCompoundUniqueInputSchema)
  }),
  z.object({
    id: z.string().cuid(),
  }),
  z.object({
    issueId_userId: z.lazy(() => UpvoteIssueIdUserIdCompoundUniqueInputSchema),
  }),
])
.and(z.object({
  id: z.string().cuid().optional(),
  issueId_userId: z.lazy(() => UpvoteIssueIdUserIdCompoundUniqueInputSchema).optional(),
  AND: z.union([ z.lazy(() => UpvoteWhereInputSchema),z.lazy(() => UpvoteWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => UpvoteWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UpvoteWhereInputSchema),z.lazy(() => UpvoteWhereInputSchema).array() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  issueId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  issue: z.union([ z.lazy(() => IssueScalarRelationFilterSchema),z.lazy(() => IssueWhereInputSchema) ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema),z.lazy(() => UserWhereInputSchema) ]).optional(),
}).strict());

export default UpvoteWhereUniqueInputSchema;
