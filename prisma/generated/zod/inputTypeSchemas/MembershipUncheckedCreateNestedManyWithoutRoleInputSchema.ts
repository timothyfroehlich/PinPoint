import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipCreateWithoutRoleInputSchema } from "./MembershipCreateWithoutRoleInputSchema";
import { MembershipUncheckedCreateWithoutRoleInputSchema } from "./MembershipUncheckedCreateWithoutRoleInputSchema";
import { MembershipCreateOrConnectWithoutRoleInputSchema } from "./MembershipCreateOrConnectWithoutRoleInputSchema";
import { MembershipCreateManyRoleInputEnvelopeSchema } from "./MembershipCreateManyRoleInputEnvelopeSchema";
import { MembershipWhereUniqueInputSchema } from "./MembershipWhereUniqueInputSchema";

export const MembershipUncheckedCreateNestedManyWithoutRoleInputSchema: z.ZodType<Prisma.MembershipUncheckedCreateNestedManyWithoutRoleInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => MembershipCreateWithoutRoleInputSchema),
          z.lazy(() => MembershipCreateWithoutRoleInputSchema).array(),
          z.lazy(() => MembershipUncheckedCreateWithoutRoleInputSchema),
          z.lazy(() => MembershipUncheckedCreateWithoutRoleInputSchema).array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => MembershipCreateOrConnectWithoutRoleInputSchema),
          z.lazy(() => MembershipCreateOrConnectWithoutRoleInputSchema).array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => MembershipCreateManyRoleInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => MembershipWhereUniqueInputSchema),
          z.lazy(() => MembershipWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipUncheckedCreateNestedManyWithoutRoleInput>;

export default MembershipUncheckedCreateNestedManyWithoutRoleInputSchema;
