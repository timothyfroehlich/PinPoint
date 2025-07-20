import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { RoleWhereUniqueInputSchema } from "./RoleWhereUniqueInputSchema";
import { RoleCreateWithoutOrganizationInputSchema } from "./RoleCreateWithoutOrganizationInputSchema";
import { RoleUncheckedCreateWithoutOrganizationInputSchema } from "./RoleUncheckedCreateWithoutOrganizationInputSchema";

export const RoleCreateOrConnectWithoutOrganizationInputSchema: z.ZodType<Prisma.RoleCreateOrConnectWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => RoleWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => RoleCreateWithoutOrganizationInputSchema),
        z.lazy(() => RoleUncheckedCreateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.RoleCreateOrConnectWithoutOrganizationInput>;

export default RoleCreateOrConnectWithoutOrganizationInputSchema;
