import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema"
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"
import { RoleArgsSchema } from "../outputTypeSchemas/RoleArgsSchema"

export const MembershipIncludeSchema: z.ZodType<Prisma.MembershipInclude> = z.object({
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
  organization: z.union([z.boolean(),z.lazy(() => OrganizationArgsSchema)]).optional(),
  role: z.union([z.boolean(),z.lazy(() => RoleArgsSchema)]).optional(),
}).strict()

export default MembershipIncludeSchema;
