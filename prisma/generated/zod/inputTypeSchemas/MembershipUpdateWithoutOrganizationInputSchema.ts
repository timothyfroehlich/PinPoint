import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { UserUpdateOneRequiredWithoutMembershipsNestedInputSchema } from "./UserUpdateOneRequiredWithoutMembershipsNestedInputSchema";
import { RoleUpdateOneRequiredWithoutMembershipsNestedInputSchema } from "./RoleUpdateOneRequiredWithoutMembershipsNestedInputSchema";

export const MembershipUpdateWithoutOrganizationInputSchema: z.ZodType<Prisma.MembershipUpdateWithoutOrganizationInput> =
  z
    .object({
      id: z
        .union([
          z.string().cuid(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      user: z
        .lazy(() => UserUpdateOneRequiredWithoutMembershipsNestedInputSchema)
        .optional(),
      role: z
        .lazy(() => RoleUpdateOneRequiredWithoutMembershipsNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipUpdateWithoutOrganizationInput>;

export default MembershipUpdateWithoutOrganizationInputSchema;
