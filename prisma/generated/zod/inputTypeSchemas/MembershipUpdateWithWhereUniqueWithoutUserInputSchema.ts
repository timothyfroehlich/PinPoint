import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipWhereUniqueInputSchema } from "./MembershipWhereUniqueInputSchema";
import { MembershipUpdateWithoutUserInputSchema } from "./MembershipUpdateWithoutUserInputSchema";
import { MembershipUncheckedUpdateWithoutUserInputSchema } from "./MembershipUncheckedUpdateWithoutUserInputSchema";

export const MembershipUpdateWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.MembershipUpdateWithWhereUniqueWithoutUserInput> =
  z
    .object({
      where: z.lazy(() => MembershipWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => MembershipUpdateWithoutUserInputSchema),
        z.lazy(() => MembershipUncheckedUpdateWithoutUserInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MembershipUpdateWithWhereUniqueWithoutUserInput>;

export default MembershipUpdateWithWhereUniqueWithoutUserInputSchema;
