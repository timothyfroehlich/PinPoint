import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CommentCreateManyIssueInputSchema } from "./CommentCreateManyIssueInputSchema";

export const CommentCreateManyIssueInputEnvelopeSchema: z.ZodType<Prisma.CommentCreateManyIssueInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => CommentCreateManyIssueInputSchema),
        z.lazy(() => CommentCreateManyIssueInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.CommentCreateManyIssueInputEnvelope>;

export default CommentCreateManyIssueInputEnvelopeSchema;
