import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipWhereUniqueInputSchema } from "./MembershipWhereUniqueInputSchema";
import { MembershipCreateWithoutRoleInputSchema } from "./MembershipCreateWithoutRoleInputSchema";
import { MembershipUncheckedCreateWithoutRoleInputSchema } from "./MembershipUncheckedCreateWithoutRoleInputSchema";

export const MembershipCreateOrConnectWithoutRoleInputSchema: z.ZodType<Prisma.MembershipCreateOrConnectWithoutRoleInput> =
  z
    .object({
      where: z.lazy(() => MembershipWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => MembershipCreateWithoutRoleInputSchema),
        z.lazy(() => MembershipUncheckedCreateWithoutRoleInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MembershipCreateOrConnectWithoutRoleInput>;

export default MembershipCreateOrConnectWithoutRoleInputSchema;
