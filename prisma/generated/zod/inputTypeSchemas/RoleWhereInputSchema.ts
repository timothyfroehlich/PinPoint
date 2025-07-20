import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { BoolFilterSchema } from './BoolFilterSchema';
import { OrganizationScalarRelationFilterSchema } from './OrganizationScalarRelationFilterSchema';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { MembershipListRelationFilterSchema } from './MembershipListRelationFilterSchema';
import { PermissionListRelationFilterSchema } from './PermissionListRelationFilterSchema';

export const RoleWhereInputSchema: z.ZodType<Prisma.RoleWhereInput> = z.object({
  AND: z.union([ z.lazy(() => RoleWhereInputSchema),z.lazy(() => RoleWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => RoleWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => RoleWhereInputSchema),z.lazy(() => RoleWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  isDefault: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  organization: z.union([ z.lazy(() => OrganizationScalarRelationFilterSchema),z.lazy(() => OrganizationWhereInputSchema) ]).optional(),
  memberships: z.lazy(() => MembershipListRelationFilterSchema).optional(),
  permissions: z.lazy(() => PermissionListRelationFilterSchema).optional()
}).strict();

export default RoleWhereInputSchema;
