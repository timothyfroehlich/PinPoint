import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { EnumStatusCategoryFilterSchema } from './EnumStatusCategoryFilterSchema';
import { StatusCategorySchema } from './StatusCategorySchema';
import { BoolFilterSchema } from './BoolFilterSchema';
import { OrganizationScalarRelationFilterSchema } from './OrganizationScalarRelationFilterSchema';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { IssueListRelationFilterSchema } from './IssueListRelationFilterSchema';

export const IssueStatusWhereInputSchema: z.ZodType<Prisma.IssueStatusWhereInput> = z.object({
  AND: z.union([ z.lazy(() => IssueStatusWhereInputSchema),z.lazy(() => IssueStatusWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => IssueStatusWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => IssueStatusWhereInputSchema),z.lazy(() => IssueStatusWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  category: z.union([ z.lazy(() => EnumStatusCategoryFilterSchema),z.lazy(() => StatusCategorySchema) ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  isDefault: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  organization: z.union([ z.lazy(() => OrganizationScalarRelationFilterSchema),z.lazy(() => OrganizationWhereInputSchema) ]).optional(),
  issues: z.lazy(() => IssueListRelationFilterSchema).optional()
}).strict();

export default IssueStatusWhereInputSchema;
