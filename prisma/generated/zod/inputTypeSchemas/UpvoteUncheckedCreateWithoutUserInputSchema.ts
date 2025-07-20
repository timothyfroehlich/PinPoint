import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const UpvoteUncheckedCreateWithoutUserInputSchema: z.ZodType<Prisma.UpvoteUncheckedCreateWithoutUserInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      createdAt: z.coerce.date().optional(),
      issueId: z.string(),
    })
    .strict() as z.ZodType<Prisma.UpvoteUncheckedCreateWithoutUserInput>;

export default UpvoteUncheckedCreateWithoutUserInputSchema;
