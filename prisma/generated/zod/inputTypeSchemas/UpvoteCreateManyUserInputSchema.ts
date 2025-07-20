import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const UpvoteCreateManyUserInputSchema: z.ZodType<Prisma.UpvoteCreateManyUserInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      createdAt: z.coerce.date().optional(),
      issueId: z.string(),
    })
    .strict() as z.ZodType<Prisma.UpvoteCreateManyUserInput>;

export default UpvoteCreateManyUserInputSchema;
