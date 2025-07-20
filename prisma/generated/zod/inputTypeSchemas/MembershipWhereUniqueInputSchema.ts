import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { MembershipUserIdOrganizationIdCompoundUniqueInputSchema } from './MembershipUserIdOrganizationIdCompoundUniqueInputSchema';
import { MembershipWhereInputSchema } from './MembershipWhereInputSchema';
import { StringFilterSchema } from './StringFilterSchema';
import { UserScalarRelationFilterSchema } from './UserScalarRelationFilterSchema';
import { UserWhereInputSchema } from './UserWhereInputSchema';
import { OrganizationScalarRelationFilterSchema } from './OrganizationScalarRelationFilterSchema';
import { OrganizationWhereInputSchema } from './OrganizationWhereInputSchema';
import { RoleScalarRelationFilterSchema } from './RoleScalarRelationFilterSchema';
import { RoleWhereInputSchema } from './RoleWhereInputSchema';

export const MembershipWhereUniqueInputSchema: z.ZodType<Prisma.MembershipWhereUniqueInput> = z.union([
  z.object({
    id: z.string().cuid(),
    userId_organizationId: z.lazy(() => MembershipUserIdOrganizationIdCompoundUniqueInputSchema)
  }),
  z.object({
    id: z.string().cuid(),
  }),
  z.object({
    userId_organizationId: z.lazy(() => MembershipUserIdOrganizationIdCompoundUniqueInputSchema),
  }),
])
.and(z.object({
  id: z.string().cuid().optional(),
  userId_organizationId: z.lazy(() => MembershipUserIdOrganizationIdCompoundUniqueInputSchema).optional(),
  AND: z.union([ z.lazy(() => MembershipWhereInputSchema),z.lazy(() => MembershipWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => MembershipWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => MembershipWhereInputSchema),z.lazy(() => MembershipWhereInputSchema).array() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  roleId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema),z.lazy(() => UserWhereInputSchema) ]).optional(),
  organization: z.union([ z.lazy(() => OrganizationScalarRelationFilterSchema),z.lazy(() => OrganizationWhereInputSchema) ]).optional(),
  role: z.union([ z.lazy(() => RoleScalarRelationFilterSchema),z.lazy(() => RoleWhereInputSchema) ]).optional(),
}).strict());

export default MembershipWhereUniqueInputSchema;
