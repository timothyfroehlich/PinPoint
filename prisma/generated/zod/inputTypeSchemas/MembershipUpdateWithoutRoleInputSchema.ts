import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { UserUpdateOneRequiredWithoutMembershipsNestedInputSchema } from "./UserUpdateOneRequiredWithoutMembershipsNestedInputSchema";
import { OrganizationUpdateOneRequiredWithoutMembershipsNestedInputSchema } from "./OrganizationUpdateOneRequiredWithoutMembershipsNestedInputSchema";

export const MembershipUpdateWithoutRoleInputSchema: z.ZodType<Prisma.MembershipUpdateWithoutRoleInput> =
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
      organization: z
        .lazy(
          () =>
            OrganizationUpdateOneRequiredWithoutMembershipsNestedInputSchema,
        )
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipUpdateWithoutRoleInput>;

export default MembershipUpdateWithoutRoleInputSchema;
