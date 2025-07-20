import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipScalarWhereInputSchema } from "./MembershipScalarWhereInputSchema";
import { MembershipUpdateManyMutationInputSchema } from "./MembershipUpdateManyMutationInputSchema";
import { MembershipUncheckedUpdateManyWithoutRoleInputSchema } from "./MembershipUncheckedUpdateManyWithoutRoleInputSchema";

export const MembershipUpdateManyWithWhereWithoutRoleInputSchema: z.ZodType<Prisma.MembershipUpdateManyWithWhereWithoutRoleInput> =
  z
    .object({
      where: z.lazy(() => MembershipScalarWhereInputSchema),
      data: z.union([
        z.lazy(() => MembershipUpdateManyMutationInputSchema),
        z.lazy(() => MembershipUncheckedUpdateManyWithoutRoleInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MembershipUpdateManyWithWhereWithoutRoleInput>;

export default MembershipUpdateManyWithWhereWithoutRoleInputSchema;
