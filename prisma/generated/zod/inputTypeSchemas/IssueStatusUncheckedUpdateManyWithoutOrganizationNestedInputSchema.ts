import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueStatusCreateWithoutOrganizationInputSchema } from "./IssueStatusCreateWithoutOrganizationInputSchema";
import { IssueStatusUncheckedCreateWithoutOrganizationInputSchema } from "./IssueStatusUncheckedCreateWithoutOrganizationInputSchema";
import { IssueStatusCreateOrConnectWithoutOrganizationInputSchema } from "./IssueStatusCreateOrConnectWithoutOrganizationInputSchema";
import { IssueStatusUpsertWithWhereUniqueWithoutOrganizationInputSchema } from "./IssueStatusUpsertWithWhereUniqueWithoutOrganizationInputSchema";
import { IssueStatusCreateManyOrganizationInputEnvelopeSchema } from "./IssueStatusCreateManyOrganizationInputEnvelopeSchema";
import { IssueStatusWhereUniqueInputSchema } from "./IssueStatusWhereUniqueInputSchema";
import { IssueStatusUpdateWithWhereUniqueWithoutOrganizationInputSchema } from "./IssueStatusUpdateWithWhereUniqueWithoutOrganizationInputSchema";
import { IssueStatusUpdateManyWithWhereWithoutOrganizationInputSchema } from "./IssueStatusUpdateManyWithWhereWithoutOrganizationInputSchema";
import { IssueStatusScalarWhereInputSchema } from "./IssueStatusScalarWhereInputSchema";

export const IssueStatusUncheckedUpdateManyWithoutOrganizationNestedInputSchema: z.ZodType<Prisma.IssueStatusUncheckedUpdateManyWithoutOrganizationNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueStatusCreateWithoutOrganizationInputSchema),
          z.lazy(() => IssueStatusCreateWithoutOrganizationInputSchema).array(),
          z.lazy(
            () => IssueStatusUncheckedCreateWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => IssueStatusUncheckedCreateWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(
            () => IssueStatusCreateOrConnectWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => IssueStatusCreateOrConnectWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(
            () =>
              IssueStatusUpsertWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                IssueStatusUpsertWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => IssueStatusCreateManyOrganizationInputEnvelopeSchema)
        .optional(),
      set: z
        .union([
          z.lazy(() => IssueStatusWhereUniqueInputSchema),
          z.lazy(() => IssueStatusWhereUniqueInputSchema).array(),
        ])
        .optional(),
      disconnect: z
        .union([
          z.lazy(() => IssueStatusWhereUniqueInputSchema),
          z.lazy(() => IssueStatusWhereUniqueInputSchema).array(),
        ])
        .optional(),
      delete: z
        .union([
          z.lazy(() => IssueStatusWhereUniqueInputSchema),
          z.lazy(() => IssueStatusWhereUniqueInputSchema).array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => IssueStatusWhereUniqueInputSchema),
          z.lazy(() => IssueStatusWhereUniqueInputSchema).array(),
        ])
        .optional(),
      update: z
        .union([
          z.lazy(
            () =>
              IssueStatusUpdateWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                IssueStatusUpdateWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(
            () => IssueStatusUpdateManyWithWhereWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                IssueStatusUpdateManyWithWhereWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      deleteMany: z
        .union([
          z.lazy(() => IssueStatusScalarWhereInputSchema),
          z.lazy(() => IssueStatusScalarWhereInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusUncheckedUpdateManyWithoutOrganizationNestedInput>;

export default IssueStatusUncheckedUpdateManyWithoutOrganizationNestedInputSchema;
