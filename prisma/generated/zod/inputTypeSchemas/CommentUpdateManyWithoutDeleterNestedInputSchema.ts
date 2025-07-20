import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CommentCreateWithoutDeleterInputSchema } from "./CommentCreateWithoutDeleterInputSchema";
import { CommentUncheckedCreateWithoutDeleterInputSchema } from "./CommentUncheckedCreateWithoutDeleterInputSchema";
import { CommentCreateOrConnectWithoutDeleterInputSchema } from "./CommentCreateOrConnectWithoutDeleterInputSchema";
import { CommentUpsertWithWhereUniqueWithoutDeleterInputSchema } from "./CommentUpsertWithWhereUniqueWithoutDeleterInputSchema";
import { CommentCreateManyDeleterInputEnvelopeSchema } from "./CommentCreateManyDeleterInputEnvelopeSchema";
import { CommentWhereUniqueInputSchema } from "./CommentWhereUniqueInputSchema";
import { CommentUpdateWithWhereUniqueWithoutDeleterInputSchema } from "./CommentUpdateWithWhereUniqueWithoutDeleterInputSchema";
import { CommentUpdateManyWithWhereWithoutDeleterInputSchema } from "./CommentUpdateManyWithWhereWithoutDeleterInputSchema";
import { CommentScalarWhereInputSchema } from "./CommentScalarWhereInputSchema";

export const CommentUpdateManyWithoutDeleterNestedInputSchema: z.ZodType<Prisma.CommentUpdateManyWithoutDeleterNestedInput> =
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
      upsert: z
        .union([
          z.lazy(() => CommentUpsertWithWhereUniqueWithoutDeleterInputSchema),
          z
            .lazy(() => CommentUpsertWithWhereUniqueWithoutDeleterInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => CommentCreateManyDeleterInputEnvelopeSchema)
        .optional(),
      set: z
        .union([
          z.lazy(() => CommentWhereUniqueInputSchema),
          z.lazy(() => CommentWhereUniqueInputSchema).array(),
        ])
        .optional(),
      disconnect: z
        .union([
          z.lazy(() => CommentWhereUniqueInputSchema),
          z.lazy(() => CommentWhereUniqueInputSchema).array(),
        ])
        .optional(),
      delete: z
        .union([
          z.lazy(() => CommentWhereUniqueInputSchema),
          z.lazy(() => CommentWhereUniqueInputSchema).array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => CommentWhereUniqueInputSchema),
          z.lazy(() => CommentWhereUniqueInputSchema).array(),
        ])
        .optional(),
      update: z
        .union([
          z.lazy(() => CommentUpdateWithWhereUniqueWithoutDeleterInputSchema),
          z
            .lazy(() => CommentUpdateWithWhereUniqueWithoutDeleterInputSchema)
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(() => CommentUpdateManyWithWhereWithoutDeleterInputSchema),
          z
            .lazy(() => CommentUpdateManyWithWhereWithoutDeleterInputSchema)
            .array(),
        ])
        .optional(),
      deleteMany: z
        .union([
          z.lazy(() => CommentScalarWhereInputSchema),
          z.lazy(() => CommentScalarWhereInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.CommentUpdateManyWithoutDeleterNestedInput>;

export default CommentUpdateManyWithoutDeleterNestedInputSchema;
