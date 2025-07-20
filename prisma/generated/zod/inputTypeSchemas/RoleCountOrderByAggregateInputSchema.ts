import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const RoleCountOrderByAggregateInputSchema: z.ZodType<Prisma.RoleCountOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      isDefault: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.RoleCountOrderByAggregateInput>;

export default RoleCountOrderByAggregateInputSchema;
