import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const VerificationTokenCountOrderByAggregateInputSchema: z.ZodType<Prisma.VerificationTokenCountOrderByAggregateInput> =
  z
    .object({
      identifier: z.lazy(() => SortOrderSchema).optional(),
      token: z.lazy(() => SortOrderSchema).optional(),
      expires: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.VerificationTokenCountOrderByAggregateInput>;

export default VerificationTokenCountOrderByAggregateInputSchema;
