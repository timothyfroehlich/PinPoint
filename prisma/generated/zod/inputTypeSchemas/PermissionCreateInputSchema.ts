import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { RoleCreateNestedManyWithoutPermissionsInputSchema } from "./RoleCreateNestedManyWithoutPermissionsInputSchema";

export const PermissionCreateInputSchema: z.ZodType<Prisma.PermissionCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      roles: z
        .lazy(() => RoleCreateNestedManyWithoutPermissionsInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.PermissionCreateInput>;

export default PermissionCreateInputSchema;
