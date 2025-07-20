import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { EnumStatusCategoryFilterSchema } from './EnumStatusCategoryFilterSchema';
import { StatusCategorySchema } from './StatusCategorySchema';
import { BoolFilterSchema } from './BoolFilterSchema';

export const IssueStatusScalarWhereInputSchema: z.ZodType<Prisma.IssueStatusScalarWhereInput> = z.object({
  AND: z.union([ z.lazy(() => IssueStatusScalarWhereInputSchema),z.lazy(() => IssueStatusScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => IssueStatusScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => IssueStatusScalarWhereInputSchema),z.lazy(() => IssueStatusScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  category: z.union([ z.lazy(() => EnumStatusCategoryFilterSchema),z.lazy(() => StatusCategorySchema) ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  isDefault: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
}).strict();

export default IssueStatusScalarWhereInputSchema;
