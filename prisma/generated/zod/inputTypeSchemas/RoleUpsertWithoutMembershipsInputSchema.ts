import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { RoleUpdateWithoutMembershipsInputSchema } from "./RoleUpdateWithoutMembershipsInputSchema";
import { RoleUncheckedUpdateWithoutMembershipsInputSchema } from "./RoleUncheckedUpdateWithoutMembershipsInputSchema";
import { RoleCreateWithoutMembershipsInputSchema } from "./RoleCreateWithoutMembershipsInputSchema";
import { RoleUncheckedCreateWithoutMembershipsInputSchema } from "./RoleUncheckedCreateWithoutMembershipsInputSchema";
import { RoleWhereInputSchema } from "./RoleWhereInputSchema";

export const RoleUpsertWithoutMembershipsInputSchema: z.ZodType<Prisma.RoleUpsertWithoutMembershipsInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => RoleUpdateWithoutMembershipsInputSchema),
        z.lazy(() => RoleUncheckedUpdateWithoutMembershipsInputSchema),
      ]),
      create: z.union([
        z.lazy(() => RoleCreateWithoutMembershipsInputSchema),
        z.lazy(() => RoleUncheckedCreateWithoutMembershipsInputSchema),
      ]),
      where: z.lazy(() => RoleWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.RoleUpsertWithoutMembershipsInput>;

export default RoleUpsertWithoutMembershipsInputSchema;
