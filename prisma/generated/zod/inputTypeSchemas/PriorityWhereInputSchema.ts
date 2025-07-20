import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { IntFilterSchema } from './IntFilterSchema';
import { BoolFilterSchema } from './BoolFilterSchema';
import { OrganizationScalarRelationFilterSchema } from './OrganizationScalarRelationFilterSchema';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { IssueListRelationFilterSchema } from './IssueListRelationFilterSchema';

export const PriorityWhereInputSchema: z.ZodType<Prisma.PriorityWhereInput> = z.object({
  AND: z.union([ z.lazy(() => PriorityWhereInputSchema),z.lazy(() => PriorityWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => PriorityWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => PriorityWhereInputSchema),z.lazy(() => PriorityWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  order: z.union([ z.lazy(() => IntFilterSchema),z.number() ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  isDefault: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  organization: z.union([ z.lazy(() => OrganizationScalarRelationFilterSchema),z.lazy(() => OrganizationWhereInputSchema) ]).optional(),
  issues: z.lazy(() => IssueListRelationFilterSchema).optional()
}).strict();

export default PriorityWhereInputSchema;
