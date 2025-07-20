import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipWhereUniqueInputSchema } from "./MembershipWhereUniqueInputSchema";
import { MembershipCreateWithoutOrganizationInputSchema } from "./MembershipCreateWithoutOrganizationInputSchema";
import { MembershipUncheckedCreateWithoutOrganizationInputSchema } from "./MembershipUncheckedCreateWithoutOrganizationInputSchema";

export const MembershipCreateOrConnectWithoutOrganizationInputSchema: z.ZodType<Prisma.MembershipCreateOrConnectWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => MembershipWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => MembershipCreateWithoutOrganizationInputSchema),
        z.lazy(() => MembershipUncheckedCreateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MembershipCreateOrConnectWithoutOrganizationInput>;

export default MembershipCreateOrConnectWithoutOrganizationInputSchema;
