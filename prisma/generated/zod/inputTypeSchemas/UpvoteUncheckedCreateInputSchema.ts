import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const UpvoteUncheckedCreateInputSchema: z.ZodType<Prisma.UpvoteUncheckedCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      createdAt: z.coerce.date().optional(),
      issueId: z.string(),
      userId: z.string(),
    })
    .strict() as z.ZodType<Prisma.UpvoteUncheckedCreateInput>;

export default UpvoteUncheckedCreateInputSchema;
