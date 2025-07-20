import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { OrganizationOrderByWithRelationInputSchema } from "./OrganizationOrderByWithRelationInputSchema";
import { MachineOrderByWithRelationInputSchema } from "./MachineOrderByWithRelationInputSchema";
import { PriorityOrderByWithRelationInputSchema } from "./PriorityOrderByWithRelationInputSchema";
import { IssueStatusOrderByWithRelationInputSchema } from "./IssueStatusOrderByWithRelationInputSchema";
import { UserOrderByWithRelationInputSchema } from "./UserOrderByWithRelationInputSchema";
import { CommentOrderByRelationAggregateInputSchema } from "./CommentOrderByRelationAggregateInputSchema";
import { AttachmentOrderByRelationAggregateInputSchema } from "./AttachmentOrderByRelationAggregateInputSchema";
import { IssueHistoryOrderByRelationAggregateInputSchema } from "./IssueHistoryOrderByRelationAggregateInputSchema";
import { UpvoteOrderByRelationAggregateInputSchema } from "./UpvoteOrderByRelationAggregateInputSchema";

export const IssueOrderByWithRelationInputSchema: z.ZodType<Prisma.IssueOrderByWithRelationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      title: z.lazy(() => SortOrderSchema).optional(),
      description: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      consistency: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      checklist: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      createdAt: z.lazy(() => SortOrderSchema).optional(),
      updatedAt: z.lazy(() => SortOrderSchema).optional(),
      resolvedAt: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      machineId: z.lazy(() => SortOrderSchema).optional(),
      statusId: z.lazy(() => SortOrderSchema).optional(),
      priorityId: z.lazy(() => SortOrderSchema).optional(),
      createdById: z.lazy(() => SortOrderSchema).optional(),
      assignedToId: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      organization: z
        .lazy(() => OrganizationOrderByWithRelationInputSchema)
        .optional(),
      machine: z.lazy(() => MachineOrderByWithRelationInputSchema).optional(),
      priority: z.lazy(() => PriorityOrderByWithRelationInputSchema).optional(),
      status: z
        .lazy(() => IssueStatusOrderByWithRelationInputSchema)
        .optional(),
      createdBy: z.lazy(() => UserOrderByWithRelationInputSchema).optional(),
      assignedTo: z.lazy(() => UserOrderByWithRelationInputSchema).optional(),
      comments: z
        .lazy(() => CommentOrderByRelationAggregateInputSchema)
        .optional(),
      attachments: z
        .lazy(() => AttachmentOrderByRelationAggregateInputSchema)
        .optional(),
      history: z
        .lazy(() => IssueHistoryOrderByRelationAggregateInputSchema)
        .optional(),
      upvotes: z
        .lazy(() => UpvoteOrderByRelationAggregateInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueOrderByWithRelationInput>;

export default IssueOrderByWithRelationInputSchema;
