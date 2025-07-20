import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationUpdateWithoutRolesInputSchema } from "./OrganizationUpdateWithoutRolesInputSchema";
import { OrganizationUncheckedUpdateWithoutRolesInputSchema } from "./OrganizationUncheckedUpdateWithoutRolesInputSchema";
import { OrganizationCreateWithoutRolesInputSchema } from "./OrganizationCreateWithoutRolesInputSchema";
import { OrganizationUncheckedCreateWithoutRolesInputSchema } from "./OrganizationUncheckedCreateWithoutRolesInputSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";

export const OrganizationUpsertWithoutRolesInputSchema: z.ZodType<Prisma.OrganizationUpsertWithoutRolesInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => OrganizationUpdateWithoutRolesInputSchema),
        z.lazy(() => OrganizationUncheckedUpdateWithoutRolesInputSchema),
      ]),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutRolesInputSchema),
        z.lazy(() => OrganizationUncheckedCreateWithoutRolesInputSchema),
      ]),
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpsertWithoutRolesInput>;

export default OrganizationUpsertWithoutRolesInputSchema;
