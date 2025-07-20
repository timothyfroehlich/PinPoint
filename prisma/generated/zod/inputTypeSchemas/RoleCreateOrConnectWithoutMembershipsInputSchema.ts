import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { RoleWhereUniqueInputSchema } from "./RoleWhereUniqueInputSchema";
import { RoleCreateWithoutMembershipsInputSchema } from "./RoleCreateWithoutMembershipsInputSchema";
import { RoleUncheckedCreateWithoutMembershipsInputSchema } from "./RoleUncheckedCreateWithoutMembershipsInputSchema";

export const RoleCreateOrConnectWithoutMembershipsInputSchema: z.ZodType<Prisma.RoleCreateOrConnectWithoutMembershipsInput> =
  z
    .object({
      where: z.lazy(() => RoleWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => RoleCreateWithoutMembershipsInputSchema),
        z.lazy(() => RoleUncheckedCreateWithoutMembershipsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.RoleCreateOrConnectWithoutMembershipsInput>;

export default RoleCreateOrConnectWithoutMembershipsInputSchema;
