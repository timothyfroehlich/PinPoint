import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { AttachmentCreateWithoutOrganizationInputSchema } from "./AttachmentCreateWithoutOrganizationInputSchema";
import { AttachmentUncheckedCreateWithoutOrganizationInputSchema } from "./AttachmentUncheckedCreateWithoutOrganizationInputSchema";
import { AttachmentCreateOrConnectWithoutOrganizationInputSchema } from "./AttachmentCreateOrConnectWithoutOrganizationInputSchema";
import { AttachmentUpsertWithWhereUniqueWithoutOrganizationInputSchema } from "./AttachmentUpsertWithWhereUniqueWithoutOrganizationInputSchema";
import { AttachmentCreateManyOrganizationInputEnvelopeSchema } from "./AttachmentCreateManyOrganizationInputEnvelopeSchema";
import { AttachmentWhereUniqueInputSchema } from "./AttachmentWhereUniqueInputSchema";
import { AttachmentUpdateWithWhereUniqueWithoutOrganizationInputSchema } from "./AttachmentUpdateWithWhereUniqueWithoutOrganizationInputSchema";
import { AttachmentUpdateManyWithWhereWithoutOrganizationInputSchema } from "./AttachmentUpdateManyWithWhereWithoutOrganizationInputSchema";
import { AttachmentScalarWhereInputSchema } from "./AttachmentScalarWhereInputSchema";

export const AttachmentUncheckedUpdateManyWithoutOrganizationNestedInputSchema: z.ZodType<Prisma.AttachmentUncheckedUpdateManyWithoutOrganizationNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => AttachmentCreateWithoutOrganizationInputSchema),
          z.lazy(() => AttachmentCreateWithoutOrganizationInputSchema).array(),
          z.lazy(() => AttachmentUncheckedCreateWithoutOrganizationInputSchema),
          z
            .lazy(() => AttachmentUncheckedCreateWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => AttachmentCreateOrConnectWithoutOrganizationInputSchema),
          z
            .lazy(() => AttachmentCreateOrConnectWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(
            () => AttachmentUpsertWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                AttachmentUpsertWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => AttachmentCreateManyOrganizationInputEnvelopeSchema)
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
          z.lazy(
            () => AttachmentUpdateWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                AttachmentUpdateWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(
            () => AttachmentUpdateManyWithWhereWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => AttachmentUpdateManyWithWhereWithoutOrganizationInputSchema,
            )
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
    .strict() as z.ZodType<Prisma.AttachmentUncheckedUpdateManyWithoutOrganizationNestedInput>;

export default AttachmentUncheckedUpdateManyWithoutOrganizationNestedInputSchema;
