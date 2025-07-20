import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { IssueOrderByWithRelationInputSchema } from "./IssueOrderByWithRelationInputSchema";
import { OrganizationOrderByWithRelationInputSchema } from "./OrganizationOrderByWithRelationInputSchema";
import { UserOrderByWithRelationInputSchema } from "./UserOrderByWithRelationInputSchema";

export const IssueHistoryOrderByWithRelationInputSchema: z.ZodType<Prisma.IssueHistoryOrderByWithRelationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      field: z.lazy(() => SortOrderSchema).optional(),
      oldValue: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      newValue: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      changedAt: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      actorId: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      type: z.lazy(() => SortOrderSchema).optional(),
      issueId: z.lazy(() => SortOrderSchema).optional(),
      issue: z.lazy(() => IssueOrderByWithRelationInputSchema).optional(),
      organization: z
        .lazy(() => OrganizationOrderByWithRelationInputSchema)
        .optional(),
      actor: z.lazy(() => UserOrderByWithRelationInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryOrderByWithRelationInput>;

export default IssueHistoryOrderByWithRelationInputSchema;
