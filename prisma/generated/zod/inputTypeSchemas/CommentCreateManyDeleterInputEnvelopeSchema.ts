import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CommentCreateManyDeleterInputSchema } from "./CommentCreateManyDeleterInputSchema";

export const CommentCreateManyDeleterInputEnvelopeSchema: z.ZodType<Prisma.CommentCreateManyDeleterInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => CommentCreateManyDeleterInputSchema),
        z.lazy(() => CommentCreateManyDeleterInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.CommentCreateManyDeleterInputEnvelope>;

export default CommentCreateManyDeleterInputEnvelopeSchema;
