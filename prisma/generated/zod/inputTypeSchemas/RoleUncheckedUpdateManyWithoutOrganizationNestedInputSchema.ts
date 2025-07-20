import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { RoleCreateWithoutOrganizationInputSchema } from "./RoleCreateWithoutOrganizationInputSchema";
import { RoleUncheckedCreateWithoutOrganizationInputSchema } from "./RoleUncheckedCreateWithoutOrganizationInputSchema";
import { RoleCreateOrConnectWithoutOrganizationInputSchema } from "./RoleCreateOrConnectWithoutOrganizationInputSchema";
import { RoleUpsertWithWhereUniqueWithoutOrganizationInputSchema } from "./RoleUpsertWithWhereUniqueWithoutOrganizationInputSchema";
import { RoleCreateManyOrganizationInputEnvelopeSchema } from "./RoleCreateManyOrganizationInputEnvelopeSchema";
import { RoleWhereUniqueInputSchema } from "./RoleWhereUniqueInputSchema";
import { RoleUpdateWithWhereUniqueWithoutOrganizationInputSchema } from "./RoleUpdateWithWhereUniqueWithoutOrganizationInputSchema";
import { RoleUpdateManyWithWhereWithoutOrganizationInputSchema } from "./RoleUpdateManyWithWhereWithoutOrganizationInputSchema";
import { RoleScalarWhereInputSchema } from "./RoleScalarWhereInputSchema";

export const RoleUncheckedUpdateManyWithoutOrganizationNestedInputSchema: z.ZodType<Prisma.RoleUncheckedUpdateManyWithoutOrganizationNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => RoleCreateWithoutOrganizationInputSchema),
          z.lazy(() => RoleCreateWithoutOrganizationInputSchema).array(),
          z.lazy(() => RoleUncheckedCreateWithoutOrganizationInputSchema),
          z
            .lazy(() => RoleUncheckedCreateWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => RoleCreateOrConnectWithoutOrganizationInputSchema),
          z
            .lazy(() => RoleCreateOrConnectWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(() => RoleUpsertWithWhereUniqueWithoutOrganizationInputSchema),
          z
            .lazy(() => RoleUpsertWithWhereUniqueWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => RoleCreateManyOrganizationInputEnvelopeSchema)
        .optional(),
      set: z
        .union([
          z.lazy(() => RoleWhereUniqueInputSchema),
          z.lazy(() => RoleWhereUniqueInputSchema).array(),
        ])
        .optional(),
      disconnect: z
        .union([
          z.lazy(() => RoleWhereUniqueInputSchema),
          z.lazy(() => RoleWhereUniqueInputSchema).array(),
        ])
        .optional(),
      delete: z
        .union([
          z.lazy(() => RoleWhereUniqueInputSchema),
          z.lazy(() => RoleWhereUniqueInputSchema).array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => RoleWhereUniqueInputSchema),
          z.lazy(() => RoleWhereUniqueInputSchema).array(),
        ])
        .optional(),
      update: z
        .union([
          z.lazy(() => RoleUpdateWithWhereUniqueWithoutOrganizationInputSchema),
          z
            .lazy(() => RoleUpdateWithWhereUniqueWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(() => RoleUpdateManyWithWhereWithoutOrganizationInputSchema),
          z
            .lazy(() => RoleUpdateManyWithWhereWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      deleteMany: z
        .union([
          z.lazy(() => RoleScalarWhereInputSchema),
          z.lazy(() => RoleScalarWhereInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.RoleUncheckedUpdateManyWithoutOrganizationNestedInput>;

export default RoleUncheckedUpdateManyWithoutOrganizationNestedInputSchema;
