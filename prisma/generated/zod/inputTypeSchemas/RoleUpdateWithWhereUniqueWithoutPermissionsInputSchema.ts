import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { RoleWhereUniqueInputSchema } from "./RoleWhereUniqueInputSchema";
import { RoleUpdateWithoutPermissionsInputSchema } from "./RoleUpdateWithoutPermissionsInputSchema";
import { RoleUncheckedUpdateWithoutPermissionsInputSchema } from "./RoleUncheckedUpdateWithoutPermissionsInputSchema";

export const RoleUpdateWithWhereUniqueWithoutPermissionsInputSchema: z.ZodType<Prisma.RoleUpdateWithWhereUniqueWithoutPermissionsInput> =
  z
    .object({
      where: z.lazy(() => RoleWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => RoleUpdateWithoutPermissionsInputSchema),
        z.lazy(() => RoleUncheckedUpdateWithoutPermissionsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.RoleUpdateWithWhereUniqueWithoutPermissionsInput>;

export default RoleUpdateWithWhereUniqueWithoutPermissionsInputSchema;
