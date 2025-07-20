import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema"
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"

export const AttachmentSelectSchema: z.ZodType<Prisma.AttachmentSelect> = z.object({
  id: z.boolean().optional(),
  url: z.boolean().optional(),
  fileName: z.boolean().optional(),
  fileType: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  organizationId: z.boolean().optional(),
  issueId: z.boolean().optional(),
  issue: z.union([z.boolean(),z.lazy(() => IssueArgsSchema)]).optional(),
  organization: z.union([z.boolean(),z.lazy(() => OrganizationArgsSchema)]).optional(),
}).strict()

export default AttachmentSelectSchema;
