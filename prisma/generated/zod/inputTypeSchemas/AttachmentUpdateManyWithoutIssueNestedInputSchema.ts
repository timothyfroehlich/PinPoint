import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { AttachmentCreateWithoutIssueInputSchema } from "./AttachmentCreateWithoutIssueInputSchema";
import { AttachmentUncheckedCreateWithoutIssueInputSchema } from "./AttachmentUncheckedCreateWithoutIssueInputSchema";
import { AttachmentCreateOrConnectWithoutIssueInputSchema } from "./AttachmentCreateOrConnectWithoutIssueInputSchema";
import { AttachmentUpsertWithWhereUniqueWithoutIssueInputSchema } from "./AttachmentUpsertWithWhereUniqueWithoutIssueInputSchema";
import { AttachmentCreateManyIssueInputEnvelopeSchema } from "./AttachmentCreateManyIssueInputEnvelopeSchema";
import { AttachmentWhereUniqueInputSchema } from "./AttachmentWhereUniqueInputSchema";
import { AttachmentUpdateWithWhereUniqueWithoutIssueInputSchema } from "./AttachmentUpdateWithWhereUniqueWithoutIssueInputSchema";
import { AttachmentUpdateManyWithWhereWithoutIssueInputSchema } from "./AttachmentUpdateManyWithWhereWithoutIssueInputSchema";
import { AttachmentScalarWhereInputSchema } from "./AttachmentScalarWhereInputSchema";

export const AttachmentUpdateManyWithoutIssueNestedInputSchema: z.ZodType<Prisma.AttachmentUpdateManyWithoutIssueNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => AttachmentCreateWithoutIssueInputSchema),
          z.lazy(() => AttachmentCreateWithoutIssueInputSchema).array(),
          z.lazy(() => AttachmentUncheckedCreateWithoutIssueInputSchema),
          z
            .lazy(() => AttachmentUncheckedCreateWithoutIssueInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => AttachmentCreateOrConnectWithoutIssueInputSchema),
          z
            .lazy(() => AttachmentCreateOrConnectWithoutIssueInputSchema)
            .array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(() => AttachmentUpsertWithWhereUniqueWithoutIssueInputSchema),
          z
            .lazy(() => AttachmentUpsertWithWhereUniqueWithoutIssueInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => AttachmentCreateManyIssueInputEnvelopeSchema)
        .optional(),
      set: z
        .union([
          z.lazy(() => AttachmentWhereUniqueInputSchema),
          z.lazy(() => AttachmentWhereUniqueInputSchema).array(),
        ])
        .optional(),
      disconnect: z
        .union([
          z.lazy(() => AttachmentWhereUniqueInputSchema),
          z.lazy(() => AttachmentWhereUniqueInputSchema).array(),
        ])
        .optional(),
      delete: z
        .union([
          z.lazy(() => AttachmentWhereUniqueInputSchema),
          z.lazy(() => AttachmentWhereUniqueInputSchema).array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => AttachmentWhereUniqueInputSchema),
          z.lazy(() => AttachmentWhereUniqueInputSchema).array(),
        ])
        .optional(),
      update: z
        .union([
          z.lazy(() => AttachmentUpdateWithWhereUniqueWithoutIssueInputSchema),
          z
            .lazy(() => AttachmentUpdateWithWhereUniqueWithoutIssueInputSchema)
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(() => AttachmentUpdateManyWithWhereWithoutIssueInputSchema),
          z
            .lazy(() => AttachmentUpdateManyWithWhereWithoutIssueInputSchema)
            .array(),
        ])
        .optional(),
      deleteMany: z
        .union([
          z.lazy(() => AttachmentScalarWhereInputSchema),
          z.lazy(() => AttachmentScalarWhereInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentUpdateManyWithoutIssueNestedInput>;

export default AttachmentUpdateManyWithoutIssueNestedInputSchema;
