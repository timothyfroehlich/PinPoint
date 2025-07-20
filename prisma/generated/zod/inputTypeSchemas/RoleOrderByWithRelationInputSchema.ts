import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { OrganizationOrderByWithRelationInputSchema } from './OrganizationOrderByWithRelationInputSchema';
import { MembershipOrderByRelationAggregateInputSchema } from './MembershipOrderByRelationAggregateInputSchema';
import { PermissionOrderByRelationAggregateInputSchema } from './PermissionOrderByRelationAggregateInputSchema';

export const RoleOrderByWithRelationInputSchema: z.ZodType<Prisma.RoleOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  organizationId: z.lazy(() => SortOrderSchema).optional(),
  isDefault: z.lazy(() => SortOrderSchema).optional(),
  organization: z.lazy(() => OrganizationOrderByWithRelationInputSchema).optional(),
  memberships: z.lazy(() => MembershipOrderByRelationAggregateInputSchema).optional(),
  permissions: z.lazy(() => PermissionOrderByRelationAggregateInputSchema).optional()
}).strict();

export default RoleOrderByWithRelationInputSchema;
