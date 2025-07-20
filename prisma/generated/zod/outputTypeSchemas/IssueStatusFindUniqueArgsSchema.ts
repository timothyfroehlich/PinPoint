import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueStatusIncludeSchema } from '../inputTypeSchemas/IssueStatusIncludeSchema'
import { IssueStatusWhereUniqueInputSchema } from '../inputTypeSchemas/IssueStatusWhereUniqueInputSchema'
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"
import { IssueFindManyArgsSchema } from "../outputTypeSchemas/IssueFindManyArgsSchema"
import { IssueStatusCountOutputTypeArgsSchema } from "../outputTypeSchemas/IssueStatusCountOutputTypeArgsSchema"
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const IssueStatusSelectSchema: z.ZodType<Prisma.IssueStatusSelect> = z.object({
  id: z.boolean().optional(),
  name: z.boolean().optional(),
  category: z.boolean().optional(),
  organizationId: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  organization: z.union([z.boolean(),z.lazy(() => OrganizationArgsSchema)]).optional(),
  issues: z.union([z.boolean(),z.lazy(() => IssueFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => IssueStatusCountOutputTypeArgsSchema)]).optional(),
}).strict()

export const IssueStatusFindUniqueArgsSchema: z.ZodType<Prisma.IssueStatusFindUniqueArgs> = z.object({
  select: IssueStatusSelectSchema.optional(),
  include: z.lazy(() => IssueStatusIncludeSchema).optional(),
  where: IssueStatusWhereUniqueInputSchema,
}).strict() ;

export default IssueStatusFindUniqueArgsSchema;
