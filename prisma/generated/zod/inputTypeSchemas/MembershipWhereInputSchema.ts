import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { UserScalarRelationFilterSchema } from './UserScalarRelationFilterSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';
import { OrganizationScalarRelationFilterSchema } from './OrganizationScalarRelationFilterSchema';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { RoleScalarRelationFilterSchema } from './RoleScalarRelationFilterSchema';
import { RoleWhereInputSchema } from './RoleWhereInputSchema';

export const MembershipWhereInputSchema: z.ZodType<Prisma.MembershipWhereInput> = z.object({
  AND: z.union([ z.lazy(() => MembershipWhereInputSchema),z.lazy(() => MembershipWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => MembershipWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => MembershipWhereInputSchema),z.lazy(() => MembershipWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  roleId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema),z.lazy(() => UserWhereInputSchema) ]).optional(),
  organization: z.union([ z.lazy(() => OrganizationScalarRelationFilterSchema),z.lazy(() => OrganizationWhereInputSchema) ]).optional(),
  role: z.union([ z.lazy(() => RoleScalarRelationFilterSchema),z.lazy(() => RoleWhereInputSchema) ]).optional(),
}).strict();

export default MembershipWhereInputSchema;
