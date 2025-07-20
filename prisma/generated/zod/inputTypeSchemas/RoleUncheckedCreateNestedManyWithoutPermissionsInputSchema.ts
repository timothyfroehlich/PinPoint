import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { RoleCreateWithoutPermissionsInputSchema } from "./RoleCreateWithoutPermissionsInputSchema";
import { RoleUncheckedCreateWithoutPermissionsInputSchema } from "./RoleUncheckedCreateWithoutPermissionsInputSchema";
import { RoleCreateOrConnectWithoutPermissionsInputSchema } from "./RoleCreateOrConnectWithoutPermissionsInputSchema";
import { RoleWhereUniqueInputSchema } from "./RoleWhereUniqueInputSchema";

export const RoleUncheckedCreateNestedManyWithoutPermissionsInputSchema: z.ZodType<Prisma.RoleUncheckedCreateNestedManyWithoutPermissionsInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => RoleCreateWithoutPermissionsInputSchema),
          z.lazy(() => RoleCreateWithoutPermissionsInputSchema).array(),
          z.lazy(() => RoleUncheckedCreateWithoutPermissionsInputSchema),
          z
            .lazy(() => RoleUncheckedCreateWithoutPermissionsInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => RoleCreateOrConnectWithoutPermissionsInputSchema),
          z
            .lazy(() => RoleCreateOrConnectWithoutPermissionsInputSchema)
            .array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => RoleWhereUniqueInputSchema),
          z.lazy(() => RoleWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.RoleUncheckedCreateNestedManyWithoutPermissionsInput>;

export default RoleUncheckedCreateNestedManyWithoutPermissionsInputSchema;
