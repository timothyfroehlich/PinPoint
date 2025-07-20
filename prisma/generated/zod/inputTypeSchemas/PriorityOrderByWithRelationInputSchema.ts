import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { OrganizationOrderByWithRelationInputSchema } from "./OrganizationOrderByWithRelationInputSchema";
import { IssueOrderByRelationAggregateInputSchema } from "./IssueOrderByRelationAggregateInputSchema";

export const PriorityOrderByWithRelationInputSchema: z.ZodType<Prisma.PriorityOrderByWithRelationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      order: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      isDefault: z.lazy(() => SortOrderSchema).optional(),
      organization: z
        .lazy(() => OrganizationOrderByWithRelationInputSchema)
        .optional(),
      issues: z.lazy(() => IssueOrderByRelationAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityOrderByWithRelationInput>;

export default PriorityOrderByWithRelationInputSchema;
