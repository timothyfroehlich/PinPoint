import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateWithoutCreatedByInputSchema } from "./IssueCreateWithoutCreatedByInputSchema";
import { IssueUncheckedCreateWithoutCreatedByInputSchema } from "./IssueUncheckedCreateWithoutCreatedByInputSchema";
import { IssueCreateOrConnectWithoutCreatedByInputSchema } from "./IssueCreateOrConnectWithoutCreatedByInputSchema";
import { IssueUpsertWithWhereUniqueWithoutCreatedByInputSchema } from "./IssueUpsertWithWhereUniqueWithoutCreatedByInputSchema";
import { IssueCreateManyCreatedByInputEnvelopeSchema } from "./IssueCreateManyCreatedByInputEnvelopeSchema";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateWithWhereUniqueWithoutCreatedByInputSchema } from "./IssueUpdateWithWhereUniqueWithoutCreatedByInputSchema";
import { IssueUpdateManyWithWhereWithoutCreatedByInputSchema } from "./IssueUpdateManyWithWhereWithoutCreatedByInputSchema";
import { IssueScalarWhereInputSchema } from "./IssueScalarWhereInputSchema";

export const IssueUpdateManyWithoutCreatedByNestedInputSchema: z.ZodType<Prisma.IssueUpdateManyWithoutCreatedByNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueCreateWithoutCreatedByInputSchema),
          z.lazy(() => IssueCreateWithoutCreatedByInputSchema).array(),
          z.lazy(() => IssueUncheckedCreateWithoutCreatedByInputSchema),
          z.lazy(() => IssueUncheckedCreateWithoutCreatedByInputSchema).array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => IssueCreateOrConnectWithoutCreatedByInputSchema),
          z.lazy(() => IssueCreateOrConnectWithoutCreatedByInputSchema).array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(() => IssueUpsertWithWhereUniqueWithoutCreatedByInputSchema),
          z
            .lazy(() => IssueUpsertWithWhereUniqueWithoutCreatedByInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => IssueCreateManyCreatedByInputEnvelopeSchema)
        .optional(),
      set: z
        .union([
          z.lazy(() => IssueWhereUniqueInputSchema),
          z.lazy(() => IssueWhereUniqueInputSchema).array(),
        ])
        .optional(),
      disconnect: z
        .union([
          z.lazy(() => IssueWhereUniqueInputSchema),
          z.lazy(() => IssueWhereUniqueInputSchema).array(),
        ])
        .optional(),
      delete: z
        .union([
          z.lazy(() => IssueWhereUniqueInputSchema),
          z.lazy(() => IssueWhereUniqueInputSchema).array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => IssueWhereUniqueInputSchema),
          z.lazy(() => IssueWhereUniqueInputSchema).array(),
        ])
        .optional(),
      update: z
        .union([
          z.lazy(() => IssueUpdateWithWhereUniqueWithoutCreatedByInputSchema),
          z
            .lazy(() => IssueUpdateWithWhereUniqueWithoutCreatedByInputSchema)
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(() => IssueUpdateManyWithWhereWithoutCreatedByInputSchema),
          z
            .lazy(() => IssueUpdateManyWithWhereWithoutCreatedByInputSchema)
            .array(),
        ])
        .optional(),
      deleteMany: z
        .union([
          z.lazy(() => IssueScalarWhereInputSchema),
          z.lazy(() => IssueScalarWhereInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateManyWithoutCreatedByNestedInput>;

export default IssueUpdateManyWithoutCreatedByNestedInputSchema;
