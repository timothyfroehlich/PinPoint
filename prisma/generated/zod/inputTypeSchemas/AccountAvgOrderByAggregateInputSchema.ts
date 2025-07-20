import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const AccountAvgOrderByAggregateInputSchema: z.ZodType<Prisma.AccountAvgOrderByAggregateInput> =
  z
    .object({
      expires_at: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.AccountAvgOrderByAggregateInput>;

export default AccountAvgOrderByAggregateInputSchema;
