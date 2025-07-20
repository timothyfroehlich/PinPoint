import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { DateTimeFilterSchema } from './DateTimeFilterSchema';
import { DateTimeNullableFilterSchema } from './DateTimeNullableFilterSchema';
import { StringNullableFilterSchema } from './StringNullableFilterSchema';
import { IssueScalarRelationFilterSchema } from './IssueScalarRelationFilterSchema';
import { IssueWhereInputSchema } from './IssueWhereInputSchema';
import { UserScalarRelationFilterSchema } from './UserScalarRelationFilterSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';
import { UserNullableScalarRelationFilterSchema } from './UserNullableScalarRelationFilterSchema';

export const CommentWhereInputSchema: z.ZodType<Prisma.CommentWhereInput> = z.object({
  AND: z.union([ z.lazy(() => CommentWhereInputSchema),z.lazy(() => CommentWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => CommentWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => CommentWhereInputSchema),z.lazy(() => CommentWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  content: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema),z.coerce.date() ]).optional().nullable(),
  deletedBy: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  issueId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  authorId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  issue: z.union([ z.lazy(() => IssueScalarRelationFilterSchema),z.lazy(() => IssueWhereInputSchema) ]).optional(),
  author: z.union([ z.lazy(() => UserScalarRelationFilterSchema),z.lazy(() => UserWhereInputSchema) ]).optional(),
  deleter: z.union([ z.lazy(() => UserNullableScalarRelationFilterSchema),z.lazy(() => UserWhereInputSchema) ]).optional().nullable(),
}).strict();

export default CommentWhereInputSchema;
