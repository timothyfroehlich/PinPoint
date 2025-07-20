import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipWhereUniqueInputSchema } from "./MembershipWhereUniqueInputSchema";
import { MembershipUpdateWithoutUserInputSchema } from "./MembershipUpdateWithoutUserInputSchema";
import { MembershipUncheckedUpdateWithoutUserInputSchema } from "./MembershipUncheckedUpdateWithoutUserInputSchema";
import { MembershipCreateWithoutUserInputSchema } from "./MembershipCreateWithoutUserInputSchema";
import { MembershipUncheckedCreateWithoutUserInputSchema } from "./MembershipUncheckedCreateWithoutUserInputSchema";

export const MembershipUpsertWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.MembershipUpsertWithWhereUniqueWithoutUserInput> =
  z
    .object({
      where: z.lazy(() => MembershipWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => MembershipUpdateWithoutUserInputSchema),
        z.lazy(() => MembershipUncheckedUpdateWithoutUserInputSchema),
      ]),
      create: z.union([
        z.lazy(() => MembershipCreateWithoutUserInputSchema),
        z.lazy(() => MembershipUncheckedCreateWithoutUserInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MembershipUpsertWithWhereUniqueWithoutUserInput>;

export default MembershipUpsertWithWhereUniqueWithoutUserInputSchema;
