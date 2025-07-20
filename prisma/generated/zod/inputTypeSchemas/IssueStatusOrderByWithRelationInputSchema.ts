import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { OrganizationOrderByWithRelationInputSchema } from './OrganizationOrderByWithRelationInputSchema';
import { IssueOrderByRelationAggregateInputSchema } from './IssueOrderByRelationAggregateInputSchema';

export const IssueStatusOrderByWithRelationInputSchema: z.ZodType<Prisma.IssueStatusOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  category: z.lazy(() => SortOrderSchema).optional(),
  organizationId: z.lazy(() => SortOrderSchema).optional(),
  isDefault: z.lazy(() => SortOrderSchema).optional(),
  organization: z.lazy(() => OrganizationOrderByWithRelationInputSchema).optional(),
  issues: z.lazy(() => IssueOrderByRelationAggregateInputSchema).optional()
}).strict();

export default IssueStatusOrderByWithRelationInputSchema;
