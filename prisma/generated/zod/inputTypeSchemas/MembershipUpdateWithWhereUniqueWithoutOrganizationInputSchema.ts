import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipWhereUniqueInputSchema } from "./MembershipWhereUniqueInputSchema";
import { MembershipUpdateWithoutOrganizationInputSchema } from "./MembershipUpdateWithoutOrganizationInputSchema";
import { MembershipUncheckedUpdateWithoutOrganizationInputSchema } from "./MembershipUncheckedUpdateWithoutOrganizationInputSchema";

export const MembershipUpdateWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.MembershipUpdateWithWhereUniqueWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => MembershipWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => MembershipUpdateWithoutOrganizationInputSchema),
        z.lazy(() => MembershipUncheckedUpdateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MembershipUpdateWithWhereUniqueWithoutOrganizationInput>;

export default MembershipUpdateWithWhereUniqueWithoutOrganizationInputSchema;
