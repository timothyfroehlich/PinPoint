import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const PermissionCountOrderByAggregateInputSchema: z.ZodType<Prisma.PermissionCountOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PermissionCountOrderByAggregateInput>;

export default PermissionCountOrderByAggregateInputSchema;
