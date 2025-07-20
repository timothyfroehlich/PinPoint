import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueIncludeSchema } from "../inputTypeSchemas/IssueIncludeSchema";
import { IssueWhereUniqueInputSchema } from "../inputTypeSchemas/IssueWhereUniqueInputSchema";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";
import { MachineArgsSchema } from "../outputTypeSchemas/MachineArgsSchema";
import { PriorityArgsSchema } from "../outputTypeSchemas/PriorityArgsSchema";
import { IssueStatusArgsSchema } from "../outputTypeSchemas/IssueStatusArgsSchema";
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema";
import { CommentFindManyArgsSchema } from "../outputTypeSchemas/CommentFindManyArgsSchema";
import { AttachmentFindManyArgsSchema } from "../outputTypeSchemas/AttachmentFindManyArgsSchema";
import { IssueHistoryFindManyArgsSchema } from "../outputTypeSchemas/IssueHistoryFindManyArgsSchema";
import { UpvoteFindManyArgsSchema } from "../outputTypeSchemas/UpvoteFindManyArgsSchema";
import { IssueCountOutputTypeArgsSchema } from "../outputTypeSchemas/IssueCountOutputTypeArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const IssueSelectSchema: z.ZodType<Prisma.IssueSelect> = z
  .object({
    id: z.boolean().optional(),
    title: z.boolean().optional(),
    description: z.boolean().optional(),
    consistency: z.boolean().optional(),
    checklist: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    resolvedAt: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    machineId: z.boolean().optional(),
    statusId: z.boolean().optional(),
    priorityId: z.boolean().optional(),
    createdById: z.boolean().optional(),
    assignedToId: z.boolean().optional(),
    organization: z
      .union([z.boolean(), z.lazy(() => OrganizationArgsSchema)])
      .optional(),
    machine: z.union([z.boolean(), z.lazy(() => MachineArgsSchema)]).optional(),
    priority: z
      .union([z.boolean(), z.lazy(() => PriorityArgsSchema)])
      .optional(),
    status: z
      .union([z.boolean(), z.lazy(() => IssueStatusArgsSchema)])
      .optional(),
    createdBy: z.union([z.boolean(), z.lazy(() => UserArgsSchema)]).optional(),
    assignedTo: z.union([z.boolean(), z.lazy(() => UserArgsSchema)]).optional(),
    comments: z
      .union([z.boolean(), z.lazy(() => CommentFindManyArgsSchema)])
      .optional(),
    attachments: z
      .union([z.boolean(), z.lazy(() => AttachmentFindManyArgsSchema)])
      .optional(),
    history: z
      .union([z.boolean(), z.lazy(() => IssueHistoryFindManyArgsSchema)])
      .optional(),
    upvotes: z
      .union([z.boolean(), z.lazy(() => UpvoteFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => IssueCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export const IssueDeleteArgsSchema: z.ZodType<Prisma.IssueDeleteArgs> = z
  .object({
    select: IssueSelectSchema.optional(),
    include: z.lazy(() => IssueIncludeSchema).optional(),
    where: IssueWhereUniqueInputSchema,
  })
  .strict() as z.ZodType<Prisma.IssueDeleteArgs>;

export default IssueDeleteArgsSchema;
