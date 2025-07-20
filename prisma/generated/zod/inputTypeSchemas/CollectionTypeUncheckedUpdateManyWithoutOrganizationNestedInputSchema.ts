import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CollectionTypeCreateWithoutOrganizationInputSchema } from "./CollectionTypeCreateWithoutOrganizationInputSchema";
import { CollectionTypeUncheckedCreateWithoutOrganizationInputSchema } from "./CollectionTypeUncheckedCreateWithoutOrganizationInputSchema";
import { CollectionTypeCreateOrConnectWithoutOrganizationInputSchema } from "./CollectionTypeCreateOrConnectWithoutOrganizationInputSchema";
import { CollectionTypeUpsertWithWhereUniqueWithoutOrganizationInputSchema } from "./CollectionTypeUpsertWithWhereUniqueWithoutOrganizationInputSchema";
import { CollectionTypeCreateManyOrganizationInputEnvelopeSchema } from "./CollectionTypeCreateManyOrganizationInputEnvelopeSchema";
import { CollectionTypeWhereUniqueInputSchema } from "./CollectionTypeWhereUniqueInputSchema";
import { CollectionTypeUpdateWithWhereUniqueWithoutOrganizationInputSchema } from "./CollectionTypeUpdateWithWhereUniqueWithoutOrganizationInputSchema";
import { CollectionTypeUpdateManyWithWhereWithoutOrganizationInputSchema } from "./CollectionTypeUpdateManyWithWhereWithoutOrganizationInputSchema";
import { CollectionTypeScalarWhereInputSchema } from "./CollectionTypeScalarWhereInputSchema";

export const CollectionTypeUncheckedUpdateManyWithoutOrganizationNestedInputSchema: z.ZodType<Prisma.CollectionTypeUncheckedUpdateManyWithoutOrganizationNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => CollectionTypeCreateWithoutOrganizationInputSchema),
          z
            .lazy(() => CollectionTypeCreateWithoutOrganizationInputSchema)
            .array(),
          z.lazy(
            () => CollectionTypeUncheckedCreateWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => CollectionTypeUncheckedCreateWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(
            () => CollectionTypeCreateOrConnectWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => CollectionTypeCreateOrConnectWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(
            () =>
              CollectionTypeUpsertWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                CollectionTypeUpsertWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => CollectionTypeCreateManyOrganizationInputEnvelopeSchema)
        .optional(),
      set: z
        .union([
          z.lazy(() => CollectionTypeWhereUniqueInputSchema),
          z.lazy(() => CollectionTypeWhereUniqueInputSchema).array(),
        ])
        .optional(),
      disconnect: z
        .union([
          z.lazy(() => CollectionTypeWhereUniqueInputSchema),
          z.lazy(() => CollectionTypeWhereUniqueInputSchema).array(),
        ])
        .optional(),
      delete: z
        .union([
          z.lazy(() => CollectionTypeWhereUniqueInputSchema),
          z.lazy(() => CollectionTypeWhereUniqueInputSchema).array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => CollectionTypeWhereUniqueInputSchema),
          z.lazy(() => CollectionTypeWhereUniqueInputSchema).array(),
        ])
        .optional(),
      update: z
        .union([
          z.lazy(
            () =>
              CollectionTypeUpdateWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                CollectionTypeUpdateWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(
            () =>
              CollectionTypeUpdateManyWithWhereWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                CollectionTypeUpdateManyWithWhereWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      deleteMany: z
        .union([
          z.lazy(() => CollectionTypeScalarWhereInputSchema),
          z.lazy(() => CollectionTypeScalarWhereInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionTypeUncheckedUpdateManyWithoutOrganizationNestedInput>;

export default CollectionTypeUncheckedUpdateManyWithoutOrganizationNestedInputSchema;
