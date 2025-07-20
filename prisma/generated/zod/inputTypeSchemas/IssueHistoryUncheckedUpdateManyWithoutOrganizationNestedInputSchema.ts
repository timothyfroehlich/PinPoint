import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueHistoryCreateWithoutOrganizationInputSchema } from "./IssueHistoryCreateWithoutOrganizationInputSchema";
import { IssueHistoryUncheckedCreateWithoutOrganizationInputSchema } from "./IssueHistoryUncheckedCreateWithoutOrganizationInputSchema";
import { IssueHistoryCreateOrConnectWithoutOrganizationInputSchema } from "./IssueHistoryCreateOrConnectWithoutOrganizationInputSchema";
import { IssueHistoryUpsertWithWhereUniqueWithoutOrganizationInputSchema } from "./IssueHistoryUpsertWithWhereUniqueWithoutOrganizationInputSchema";
import { IssueHistoryCreateManyOrganizationInputEnvelopeSchema } from "./IssueHistoryCreateManyOrganizationInputEnvelopeSchema";
import { IssueHistoryWhereUniqueInputSchema } from "./IssueHistoryWhereUniqueInputSchema";
import { IssueHistoryUpdateWithWhereUniqueWithoutOrganizationInputSchema } from "./IssueHistoryUpdateWithWhereUniqueWithoutOrganizationInputSchema";
import { IssueHistoryUpdateManyWithWhereWithoutOrganizationInputSchema } from "./IssueHistoryUpdateManyWithWhereWithoutOrganizationInputSchema";
import { IssueHistoryScalarWhereInputSchema } from "./IssueHistoryScalarWhereInputSchema";

export const IssueHistoryUncheckedUpdateManyWithoutOrganizationNestedInputSchema: z.ZodType<Prisma.IssueHistoryUncheckedUpdateManyWithoutOrganizationNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueHistoryCreateWithoutOrganizationInputSchema),
          z
            .lazy(() => IssueHistoryCreateWithoutOrganizationInputSchema)
            .array(),
          z.lazy(
            () => IssueHistoryUncheckedCreateWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => IssueHistoryUncheckedCreateWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(
            () => IssueHistoryCreateOrConnectWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => IssueHistoryCreateOrConnectWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(
            () =>
              IssueHistoryUpsertWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                IssueHistoryUpsertWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => IssueHistoryCreateManyOrganizationInputEnvelopeSchema)
        .optional(),
      set: z
        .union([
          z.lazy(() => IssueHistoryWhereUniqueInputSchema),
          z.lazy(() => IssueHistoryWhereUniqueInputSchema).array(),
        ])
        .optional(),
      disconnect: z
        .union([
          z.lazy(() => IssueHistoryWhereUniqueInputSchema),
          z.lazy(() => IssueHistoryWhereUniqueInputSchema).array(),
        ])
        .optional(),
      delete: z
        .union([
          z.lazy(() => IssueHistoryWhereUniqueInputSchema),
          z.lazy(() => IssueHistoryWhereUniqueInputSchema).array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => IssueHistoryWhereUniqueInputSchema),
          z.lazy(() => IssueHistoryWhereUniqueInputSchema).array(),
        ])
        .optional(),
      update: z
        .union([
          z.lazy(
            () =>
              IssueHistoryUpdateWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                IssueHistoryUpdateWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(
            () => IssueHistoryUpdateManyWithWhereWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                IssueHistoryUpdateManyWithWhereWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      deleteMany: z
        .union([
          z.lazy(() => IssueHistoryScalarWhereInputSchema),
          z.lazy(() => IssueHistoryScalarWhereInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryUncheckedUpdateManyWithoutOrganizationNestedInput>;

export default IssueHistoryUncheckedUpdateManyWithoutOrganizationNestedInputSchema;
