import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFilterSchema } from "./StringFilterSchema";
import { StringNullableFilterSchema } from "./StringNullableFilterSchema";
import { DateTimeFilterSchema } from "./DateTimeFilterSchema";
import { EnumActivityTypeFilterSchema } from "./EnumActivityTypeFilterSchema";
import { ActivityTypeSchema } from "./ActivityTypeSchema";
import { IssueScalarRelationFilterSchema } from "./IssueScalarRelationFilterSchema";
import { IssueWhereInputSchema } from "./IssueWhereInputSchema";
import { OrganizationScalarRelationFilterSchema } from "./OrganizationScalarRelationFilterSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";
import { UserNullableScalarRelationFilterSchema } from "./UserNullableScalarRelationFilterSchema";
import { UserWhereInputSchema } from "./UserWhereInputSchema";

export const IssueHistoryWhereInputSchema: z.ZodType<Prisma.IssueHistoryWhereInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => IssueHistoryWhereInputSchema),
          z.lazy(() => IssueHistoryWhereInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => IssueHistoryWhereInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => IssueHistoryWhereInputSchema),
          z.lazy(() => IssueHistoryWhereInputSchema).array(),
        ])
        .optional(),
      id: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
      field: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
      oldValue: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      newValue: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      changedAt: z
        .union([z.lazy(() => DateTimeFilterSchema), z.coerce.date()])
        .optional(),
      organizationId: z
        .union([z.lazy(() => StringFilterSchema), z.string()])
        .optional(),
      actorId: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      type: z
        .union([
          z.lazy(() => EnumActivityTypeFilterSchema),
          z.lazy(() => ActivityTypeSchema),
        ])
        .optional(),
      issueId: z
        .union([z.lazy(() => StringFilterSchema), z.string()])
        .optional(),
      issue: z
        .union([
          z.lazy(() => IssueScalarRelationFilterSchema),
          z.lazy(() => IssueWhereInputSchema),
        ])
        .optional(),
      organization: z
        .union([
          z.lazy(() => OrganizationScalarRelationFilterSchema),
          z.lazy(() => OrganizationWhereInputSchema),
        ])
        .optional(),
      actor: z
        .union([
          z.lazy(() => UserNullableScalarRelationFilterSchema),
          z.lazy(() => UserWhereInputSchema),
        ])
        .optional()
        .nullable(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryWhereInput>;

export default IssueHistoryWhereInputSchema;
