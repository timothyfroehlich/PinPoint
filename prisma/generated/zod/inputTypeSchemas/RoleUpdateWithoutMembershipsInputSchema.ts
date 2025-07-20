import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { BoolFieldUpdateOperationsInputSchema } from "./BoolFieldUpdateOperationsInputSchema";
import { OrganizationUpdateOneRequiredWithoutRolesNestedInputSchema } from "./OrganizationUpdateOneRequiredWithoutRolesNestedInputSchema";
import { PermissionUpdateManyWithoutRolesNestedInputSchema } from "./PermissionUpdateManyWithoutRolesNestedInputSchema";

export const RoleUpdateWithoutMembershipsInputSchema: z.ZodType<Prisma.RoleUpdateWithoutMembershipsInput> =
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
      isDefault: z
        .union([
          z.boolean(),
          z.lazy(() => BoolFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      organization: z
        .lazy(() => OrganizationUpdateOneRequiredWithoutRolesNestedInputSchema)
        .optional(),
      permissions: z
        .lazy(() => PermissionUpdateManyWithoutRolesNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.RoleUpdateWithoutMembershipsInput>;

export default RoleUpdateWithoutMembershipsInputSchema;
