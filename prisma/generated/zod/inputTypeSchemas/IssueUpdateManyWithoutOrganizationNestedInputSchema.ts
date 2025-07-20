import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateWithoutOrganizationInputSchema } from "./IssueCreateWithoutOrganizationInputSchema";
import { IssueUncheckedCreateWithoutOrganizationInputSchema } from "./IssueUncheckedCreateWithoutOrganizationInputSchema";
import { IssueCreateOrConnectWithoutOrganizationInputSchema } from "./IssueCreateOrConnectWithoutOrganizationInputSchema";
import { IssueUpsertWithWhereUniqueWithoutOrganizationInputSchema } from "./IssueUpsertWithWhereUniqueWithoutOrganizationInputSchema";
import { IssueCreateManyOrganizationInputEnvelopeSchema } from "./IssueCreateManyOrganizationInputEnvelopeSchema";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateWithWhereUniqueWithoutOrganizationInputSchema } from "./IssueUpdateWithWhereUniqueWithoutOrganizationInputSchema";
import { IssueUpdateManyWithWhereWithoutOrganizationInputSchema } from "./IssueUpdateManyWithWhereWithoutOrganizationInputSchema";
import { IssueScalarWhereInputSchema } from "./IssueScalarWhereInputSchema";

export const IssueUpdateManyWithoutOrganizationNestedInputSchema: z.ZodType<Prisma.IssueUpdateManyWithoutOrganizationNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueCreateWithoutOrganizationInputSchema),
          z.lazy(() => IssueCreateWithoutOrganizationInputSchema).array(),
          z.lazy(() => IssueUncheckedCreateWithoutOrganizationInputSchema),
          z
            .lazy(() => IssueUncheckedCreateWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => IssueCreateOrConnectWithoutOrganizationInputSchema),
          z
            .lazy(() => IssueCreateOrConnectWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(
            () => IssueUpsertWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => IssueUpsertWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => IssueCreateManyOrganizationInputEnvelopeSchema)
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
          z.lazy(
            () => IssueUpdateWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => IssueUpdateWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(() => IssueUpdateManyWithWhereWithoutOrganizationInputSchema),
          z
            .lazy(() => IssueUpdateManyWithWhereWithoutOrganizationInputSchema)
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
    .strict() as z.ZodType<Prisma.IssueUpdateManyWithoutOrganizationNestedInput>;

export default IssueUpdateManyWithoutOrganizationNestedInputSchema;
