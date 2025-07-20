import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipWhereUniqueInputSchema } from "./MembershipWhereUniqueInputSchema";
import { MembershipCreateWithoutUserInputSchema } from "./MembershipCreateWithoutUserInputSchema";
import { MembershipUncheckedCreateWithoutUserInputSchema } from "./MembershipUncheckedCreateWithoutUserInputSchema";

export const MembershipCreateOrConnectWithoutUserInputSchema: z.ZodType<Prisma.MembershipCreateOrConnectWithoutUserInput> =
  z
    .object({
      where: z.lazy(() => MembershipWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => MembershipCreateWithoutUserInputSchema),
        z.lazy(() => MembershipUncheckedCreateWithoutUserInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MembershipCreateOrConnectWithoutUserInput>;

export default MembershipCreateOrConnectWithoutUserInputSchema;
