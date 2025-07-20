import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CommentWhereUniqueInputSchema } from "./CommentWhereUniqueInputSchema";
import { CommentUpdateWithoutIssueInputSchema } from "./CommentUpdateWithoutIssueInputSchema";
import { CommentUncheckedUpdateWithoutIssueInputSchema } from "./CommentUncheckedUpdateWithoutIssueInputSchema";

export const CommentUpdateWithWhereUniqueWithoutIssueInputSchema: z.ZodType<Prisma.CommentUpdateWithWhereUniqueWithoutIssueInput> =
  z
    .object({
      where: z.lazy(() => CommentWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => CommentUpdateWithoutIssueInputSchema),
        z.lazy(() => CommentUncheckedUpdateWithoutIssueInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.CommentUpdateWithWhereUniqueWithoutIssueInput>;

export default CommentUpdateWithWhereUniqueWithoutIssueInputSchema;
