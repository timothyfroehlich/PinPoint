import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PermissionWhereUniqueInputSchema } from "./PermissionWhereUniqueInputSchema";
import { PermissionUpdateWithoutRolesInputSchema } from "./PermissionUpdateWithoutRolesInputSchema";
import { PermissionUncheckedUpdateWithoutRolesInputSchema } from "./PermissionUncheckedUpdateWithoutRolesInputSchema";
import { PermissionCreateWithoutRolesInputSchema } from "./PermissionCreateWithoutRolesInputSchema";
import { PermissionUncheckedCreateWithoutRolesInputSchema } from "./PermissionUncheckedCreateWithoutRolesInputSchema";

export const PermissionUpsertWithWhereUniqueWithoutRolesInputSchema: z.ZodType<Prisma.PermissionUpsertWithWhereUniqueWithoutRolesInput> =
  z
    .object({
      where: z.lazy(() => PermissionWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => PermissionUpdateWithoutRolesInputSchema),
        z.lazy(() => PermissionUncheckedUpdateWithoutRolesInputSchema),
      ]),
      create: z.union([
        z.lazy(() => PermissionCreateWithoutRolesInputSchema),
        z.lazy(() => PermissionUncheckedCreateWithoutRolesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.PermissionUpsertWithWhereUniqueWithoutRolesInput>;

export default PermissionUpsertWithWhereUniqueWithoutRolesInputSchema;
