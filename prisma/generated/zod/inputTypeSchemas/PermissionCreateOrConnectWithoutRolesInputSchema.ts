import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PermissionWhereUniqueInputSchema } from "./PermissionWhereUniqueInputSchema";
import { PermissionCreateWithoutRolesInputSchema } from "./PermissionCreateWithoutRolesInputSchema";
import { PermissionUncheckedCreateWithoutRolesInputSchema } from "./PermissionUncheckedCreateWithoutRolesInputSchema";

export const PermissionCreateOrConnectWithoutRolesInputSchema: z.ZodType<Prisma.PermissionCreateOrConnectWithoutRolesInput> =
  z
    .object({
      where: z.lazy(() => PermissionWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => PermissionCreateWithoutRolesInputSchema),
        z.lazy(() => PermissionUncheckedCreateWithoutRolesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.PermissionCreateOrConnectWithoutRolesInput>;

export default PermissionCreateOrConnectWithoutRolesInputSchema;
