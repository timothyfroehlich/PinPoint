import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFilterSchema } from "./StringFilterSchema";
import { StringNullableFilterSchema } from "./StringNullableFilterSchema";
import { JsonNullableFilterSchema } from "./JsonNullableFilterSchema";
import { DateTimeFilterSchema } from "./DateTimeFilterSchema";
import { DateTimeNullableFilterSchema } from "./DateTimeNullableFilterSchema";
import { OrganizationScalarRelationFilterSchema } from "./OrganizationScalarRelationFilterSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";
import { MachineScalarRelationFilterSchema } from "./MachineScalarRelationFilterSchema";
import { MachineWhereInputSchema } from "./MachineWhereInputSchema";
import { PriorityScalarRelationFilterSchema } from "./PriorityScalarRelationFilterSchema";
import { PriorityWhereInputSchema } from "./PriorityWhereInputSchema";
import { IssueStatusScalarRelationFilterSchema } from "./IssueStatusScalarRelationFilterSchema";
import { IssueStatusWhereInputSchema } from "./IssueStatusWhereInputSchema";
import { UserScalarRelationFilterSchema } from "./UserScalarRelationFilterSchema";
import { UserWhereInputSchema } from "./UserWhereInputSchema";
import { UserNullableScalarRelationFilterSchema } from "./UserNullableScalarRelationFilterSchema";
import { CommentListRelationFilterSchema } from "./CommentListRelationFilterSchema";
import { AttachmentListRelationFilterSchema } from "./AttachmentListRelationFilterSchema";
import { IssueHistoryListRelationFilterSchema } from "./IssueHistoryListRelationFilterSchema";
import { UpvoteListRelationFilterSchema } from "./UpvoteListRelationFilterSchema";

export const IssueWhereInputSchema: z.ZodType<Prisma.IssueWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => IssueWhereInputSchema),
        z.lazy(() => IssueWhereInputSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => IssueWhereInputSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => IssueWhereInputSchema),
        z.lazy(() => IssueWhereInputSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
    title: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
    description: z
      .union([z.lazy(() => StringNullableFilterSchema), z.string()])
      .optional()
      .nullable(),
    consistency: z
      .union([z.lazy(() => StringNullableFilterSchema), z.string()])
      .optional()
      .nullable(),
    checklist: z.lazy(() => JsonNullableFilterSchema).optional(),
    createdAt: z
      .union([z.lazy(() => DateTimeFilterSchema), z.coerce.date()])
      .optional(),
    updatedAt: z
      .union([z.lazy(() => DateTimeFilterSchema), z.coerce.date()])
      .optional(),
    resolvedAt: z
      .union([z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date()])
      .optional()
      .nullable(),
    organizationId: z
      .union([z.lazy(() => StringFilterSchema), z.string()])
      .optional(),
    machineId: z
      .union([z.lazy(() => StringFilterSchema), z.string()])
      .optional(),
    statusId: z
      .union([z.lazy(() => StringFilterSchema), z.string()])
      .optional(),
    priorityId: z
      .union([z.lazy(() => StringFilterSchema), z.string()])
      .optional(),
    createdById: z
      .union([z.lazy(() => StringFilterSchema), z.string()])
      .optional(),
    assignedToId: z
      .union([z.lazy(() => StringNullableFilterSchema), z.string()])
      .optional()
      .nullable(),
    organization: z
      .union([
        z.lazy(() => OrganizationScalarRelationFilterSchema),
        z.lazy(() => OrganizationWhereInputSchema),
      ])
      .optional(),
    machine: z
      .union([
        z.lazy(() => MachineScalarRelationFilterSchema),
        z.lazy(() => MachineWhereInputSchema),
      ])
      .optional(),
    priority: z
      .union([
        z.lazy(() => PriorityScalarRelationFilterSchema),
        z.lazy(() => PriorityWhereInputSchema),
      ])
      .optional(),
    status: z
      .union([
        z.lazy(() => IssueStatusScalarRelationFilterSchema),
        z.lazy(() => IssueStatusWhereInputSchema),
      ])
      .optional(),
    createdBy: z
      .union([
        z.lazy(() => UserScalarRelationFilterSchema),
        z.lazy(() => UserWhereInputSchema),
      ])
      .optional(),
    assignedTo: z
      .union([
        z.lazy(() => UserNullableScalarRelationFilterSchema),
        z.lazy(() => UserWhereInputSchema),
      ])
      .optional()
      .nullable(),
    comments: z.lazy(() => CommentListRelationFilterSchema).optional(),
    attachments: z.lazy(() => AttachmentListRelationFilterSchema).optional(),
    history: z.lazy(() => IssueHistoryListRelationFilterSchema).optional(),
    upvotes: z.lazy(() => UpvoteListRelationFilterSchema).optional(),
  })
  .strict() as z.ZodType<Prisma.IssueWhereInput>;

export default IssueWhereInputSchema;
