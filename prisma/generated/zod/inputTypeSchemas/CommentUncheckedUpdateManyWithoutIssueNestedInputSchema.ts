import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CommentCreateWithoutIssueInputSchema } from "./CommentCreateWithoutIssueInputSchema";
import { CommentUncheckedCreateWithoutIssueInputSchema } from "./CommentUncheckedCreateWithoutIssueInputSchema";
import { CommentCreateOrConnectWithoutIssueInputSchema } from "./CommentCreateOrConnectWithoutIssueInputSchema";
import { CommentUpsertWithWhereUniqueWithoutIssueInputSchema } from "./CommentUpsertWithWhereUniqueWithoutIssueInputSchema";
import { CommentCreateManyIssueInputEnvelopeSchema } from "./CommentCreateManyIssueInputEnvelopeSchema";
import { CommentWhereUniqueInputSchema } from "./CommentWhereUniqueInputSchema";
import { CommentUpdateWithWhereUniqueWithoutIssueInputSchema } from "./CommentUpdateWithWhereUniqueWithoutIssueInputSchema";
import { CommentUpdateManyWithWhereWithoutIssueInputSchema } from "./CommentUpdateManyWithWhereWithoutIssueInputSchema";
import { CommentScalarWhereInputSchema } from "./CommentScalarWhereInputSchema";

export const CommentUncheckedUpdateManyWithoutIssueNestedInputSchema: z.ZodType<Prisma.CommentUncheckedUpdateManyWithoutIssueNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => CommentCreateWithoutIssueInputSchema),
          z.lazy(() => CommentCreateWithoutIssueInputSchema).array(),
          z.lazy(() => CommentUncheckedCreateWithoutIssueInputSchema),
          z.lazy(() => CommentUncheckedCreateWithoutIssueInputSchema).array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => CommentCreateOrConnectWithoutIssueInputSchema),
          z.lazy(() => CommentCreateOrConnectWithoutIssueInputSchema).array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(() => CommentUpsertWithWhereUniqueWithoutIssueInputSchema),
          z
            .lazy(() => CommentUpsertWithWhereUniqueWithoutIssueInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => CommentCreateManyIssueInputEnvelopeSchema)
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
          z.lazy(() => CommentUpdateWithWhereUniqueWithoutIssueInputSchema),
          z
            .lazy(() => CommentUpdateWithWhereUniqueWithoutIssueInputSchema)
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(() => CommentUpdateManyWithWhereWithoutIssueInputSchema),
          z
            .lazy(() => CommentUpdateManyWithWhereWithoutIssueInputSchema)
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
    .strict() as z.ZodType<Prisma.CommentUncheckedUpdateManyWithoutIssueNestedInput>;

export default CommentUncheckedUpdateManyWithoutIssueNestedInputSchema;
