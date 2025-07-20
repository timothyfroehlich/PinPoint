import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { AttachmentIncludeSchema } from '../inputTypeSchemas/AttachmentIncludeSchema'
import { AttachmentWhereUniqueInputSchema } from '../inputTypeSchemas/AttachmentWhereUniqueInputSchema'
import { AttachmentCreateInputSchema } from '../inputTypeSchemas/AttachmentCreateInputSchema'
import { AttachmentUncheckedCreateInputSchema } from '../inputTypeSchemas/AttachmentUncheckedCreateInputSchema'
import { AttachmentUpdateInputSchema } from '../inputTypeSchemas/AttachmentUpdateInputSchema'
import { AttachmentUncheckedUpdateInputSchema } from '../inputTypeSchemas/AttachmentUncheckedUpdateInputSchema'
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema"
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

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

export const AttachmentUpsertArgsSchema: z.ZodType<Prisma.AttachmentUpsertArgs> = z.object({
  select: AttachmentSelectSchema.optional(),
  include: z.lazy(() => AttachmentIncludeSchema).optional(),
  where: AttachmentWhereUniqueInputSchema,
  create: z.union([ AttachmentCreateInputSchema,AttachmentUncheckedCreateInputSchema ]),
  update: z.union([ AttachmentUpdateInputSchema,AttachmentUncheckedUpdateInputSchema ]),
}).strict() ;

export default AttachmentUpsertArgsSchema;
