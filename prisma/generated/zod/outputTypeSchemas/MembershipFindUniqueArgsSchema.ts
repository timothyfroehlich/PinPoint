import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { MembershipIncludeSchema } from '../inputTypeSchemas/MembershipIncludeSchema'
import { MembershipWhereUniqueInputSchema } from '../inputTypeSchemas/MembershipWhereUniqueInputSchema'
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema"
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"
import { RoleArgsSchema } from "../outputTypeSchemas/RoleArgsSchema"
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const MembershipSelectSchema: z.ZodType<Prisma.MembershipSelect> = z.object({
  id: z.boolean().optional(),
  userId: z.boolean().optional(),
  organizationId: z.boolean().optional(),
  roleId: z.boolean().optional(),
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
  organization: z.union([z.boolean(),z.lazy(() => OrganizationArgsSchema)]).optional(),
  role: z.union([z.boolean(),z.lazy(() => RoleArgsSchema)]).optional(),
}).strict()

export const MembershipFindUniqueArgsSchema: z.ZodType<Prisma.MembershipFindUniqueArgs> = z.object({
  select: MembershipSelectSchema.optional(),
  include: z.lazy(() => MembershipIncludeSchema).optional(),
  where: MembershipWhereUniqueInputSchema,
}).strict() ;

export default MembershipFindUniqueArgsSchema;
