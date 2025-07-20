import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema"
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema"

export const IssueHistorySelectSchema: z.ZodType<Prisma.IssueHistorySelect> = z.object({
  id: z.boolean().optional(),
  field: z.boolean().optional(),
  oldValue: z.boolean().optional(),
  newValue: z.boolean().optional(),
  changedAt: z.boolean().optional(),
  organizationId: z.boolean().optional(),
  actorId: z.boolean().optional(),
  type: z.boolean().optional(),
  issueId: z.boolean().optional(),
  issue: z.union([z.boolean(),z.lazy(() => IssueArgsSchema)]).optional(),
  organization: z.union([z.boolean(),z.lazy(() => OrganizationArgsSchema)]).optional(),
  actor: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
}).strict()

export default IssueHistorySelectSchema;
