import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const RoleMaxOrderByAggregateInputSchema: z.ZodType<Prisma.RoleMaxOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      isDefault: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.RoleMaxOrderByAggregateInput>;

export default RoleMaxOrderByAggregateInputSchema;
