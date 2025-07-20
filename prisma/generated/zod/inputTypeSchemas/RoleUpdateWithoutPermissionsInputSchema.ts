import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { BoolFieldUpdateOperationsInputSchema } from "./BoolFieldUpdateOperationsInputSchema";
import { OrganizationUpdateOneRequiredWithoutRolesNestedInputSchema } from "./OrganizationUpdateOneRequiredWithoutRolesNestedInputSchema";
import { MembershipUpdateManyWithoutRoleNestedInputSchema } from "./MembershipUpdateManyWithoutRoleNestedInputSchema";

export const RoleUpdateWithoutPermissionsInputSchema: z.ZodType<Prisma.RoleUpdateWithoutPermissionsInput> =
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
      memberships: z
        .lazy(() => MembershipUpdateManyWithoutRoleNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.RoleUpdateWithoutPermissionsInput>;

export default RoleUpdateWithoutPermissionsInputSchema;
