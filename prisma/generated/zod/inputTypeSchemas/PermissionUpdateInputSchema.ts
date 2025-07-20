import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { RoleUpdateManyWithoutPermissionsNestedInputSchema } from "./RoleUpdateManyWithoutPermissionsNestedInputSchema";

export const PermissionUpdateInputSchema: z.ZodType<Prisma.PermissionUpdateInput> =
  z
    .object({
      id: z
        .union([
          z.string().cuid(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      name: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      roles: z
        .lazy(() => RoleUpdateManyWithoutPermissionsNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.PermissionUpdateInput>;

export default PermissionUpdateInputSchema;
