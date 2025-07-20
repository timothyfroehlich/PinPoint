import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereInputSchema } from "./IssueWhereInputSchema";
import { IssueUpdateWithoutUpvotesInputSchema } from "./IssueUpdateWithoutUpvotesInputSchema";
import { IssueUncheckedUpdateWithoutUpvotesInputSchema } from "./IssueUncheckedUpdateWithoutUpvotesInputSchema";

export const IssueUpdateToOneWithWhereWithoutUpvotesInputSchema: z.ZodType<Prisma.IssueUpdateToOneWithWhereWithoutUpvotesInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => IssueUpdateWithoutUpvotesInputSchema),
        z.lazy(() => IssueUncheckedUpdateWithoutUpvotesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateToOneWithWhereWithoutUpvotesInput>;

export default IssueUpdateToOneWithWhereWithoutUpvotesInputSchema;
