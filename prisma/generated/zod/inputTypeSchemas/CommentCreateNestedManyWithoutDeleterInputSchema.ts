import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CommentCreateWithoutDeleterInputSchema } from "./CommentCreateWithoutDeleterInputSchema";
import { CommentUncheckedCreateWithoutDeleterInputSchema } from "./CommentUncheckedCreateWithoutDeleterInputSchema";
import { CommentCreateOrConnectWithoutDeleterInputSchema } from "./CommentCreateOrConnectWithoutDeleterInputSchema";
import { CommentCreateManyDeleterInputEnvelopeSchema } from "./CommentCreateManyDeleterInputEnvelopeSchema";
import { CommentWhereUniqueInputSchema } from "./CommentWhereUniqueInputSchema";

export const CommentCreateNestedManyWithoutDeleterInputSchema: z.ZodType<Prisma.CommentCreateNestedManyWithoutDeleterInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => CommentCreateWithoutDeleterInputSchema),
          z.lazy(() => CommentCreateWithoutDeleterInputSchema).array(),
          z.lazy(() => CommentUncheckedCreateWithoutDeleterInputSchema),
          z.lazy(() => CommentUncheckedCreateWithoutDeleterInputSchema).array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => CommentCreateOrConnectWithoutDeleterInputSchema),
          z.lazy(() => CommentCreateOrConnectWithoutDeleterInputSchema).array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => CommentCreateManyDeleterInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => CommentWhereUniqueInputSchema),
          z.lazy(() => CommentWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.CommentCreateNestedManyWithoutDeleterInput>;

export default CommentCreateNestedManyWithoutDeleterInputSchema;
