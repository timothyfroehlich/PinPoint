import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const UpvoteUncheckedCreateWithoutIssueInputSchema: z.ZodType<Prisma.UpvoteUncheckedCreateWithoutIssueInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      createdAt: z.coerce.date().optional(),
      userId: z.string(),
    })
    .strict() as z.ZodType<Prisma.UpvoteUncheckedCreateWithoutIssueInput>;

export default UpvoteUncheckedCreateWithoutIssueInputSchema;
