import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserCreateNestedOneWithoutUpvotesInputSchema } from "./UserCreateNestedOneWithoutUpvotesInputSchema";

export const UpvoteCreateWithoutIssueInputSchema: z.ZodType<Prisma.UpvoteCreateWithoutIssueInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      createdAt: z.coerce.date().optional(),
      user: z.lazy(() => UserCreateNestedOneWithoutUpvotesInputSchema),
    })
    .strict() as z.ZodType<Prisma.UpvoteCreateWithoutIssueInput>;

export default UpvoteCreateWithoutIssueInputSchema;
