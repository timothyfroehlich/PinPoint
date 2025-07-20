import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CommentCreateWithoutAuthorInputSchema } from "./CommentCreateWithoutAuthorInputSchema";
import { CommentUncheckedCreateWithoutAuthorInputSchema } from "./CommentUncheckedCreateWithoutAuthorInputSchema";
import { CommentCreateOrConnectWithoutAuthorInputSchema } from "./CommentCreateOrConnectWithoutAuthorInputSchema";
import { CommentCreateManyAuthorInputEnvelopeSchema } from "./CommentCreateManyAuthorInputEnvelopeSchema";
import { CommentWhereUniqueInputSchema } from "./CommentWhereUniqueInputSchema";

export const CommentUncheckedCreateNestedManyWithoutAuthorInputSchema: z.ZodType<Prisma.CommentUncheckedCreateNestedManyWithoutAuthorInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => CommentCreateWithoutAuthorInputSchema),
          z.lazy(() => CommentCreateWithoutAuthorInputSchema).array(),
          z.lazy(() => CommentUncheckedCreateWithoutAuthorInputSchema),
          z.lazy(() => CommentUncheckedCreateWithoutAuthorInputSchema).array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => CommentCreateOrConnectWithoutAuthorInputSchema),
          z.lazy(() => CommentCreateOrConnectWithoutAuthorInputSchema).array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => CommentCreateManyAuthorInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => CommentWhereUniqueInputSchema),
          z.lazy(() => CommentWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.CommentUncheckedCreateNestedManyWithoutAuthorInput>;

export default CommentUncheckedCreateNestedManyWithoutAuthorInputSchema;
