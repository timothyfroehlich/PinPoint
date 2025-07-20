import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PermissionScalarWhereInputSchema } from "./PermissionScalarWhereInputSchema";
import { PermissionUpdateManyMutationInputSchema } from "./PermissionUpdateManyMutationInputSchema";
import { PermissionUncheckedUpdateManyWithoutRolesInputSchema } from "./PermissionUncheckedUpdateManyWithoutRolesInputSchema";

export const PermissionUpdateManyWithWhereWithoutRolesInputSchema: z.ZodType<Prisma.PermissionUpdateManyWithWhereWithoutRolesInput> =
  z
    .object({
      where: z.lazy(() => PermissionScalarWhereInputSchema),
      data: z.union([
        z.lazy(() => PermissionUpdateManyMutationInputSchema),
        z.lazy(() => PermissionUncheckedUpdateManyWithoutRolesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.PermissionUpdateManyWithWhereWithoutRolesInput>;

export default PermissionUpdateManyWithWhereWithoutRolesInputSchema;
