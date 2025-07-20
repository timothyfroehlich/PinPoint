import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";
import { OrganizationUpdateWithoutMembershipsInputSchema } from "./OrganizationUpdateWithoutMembershipsInputSchema";
import { OrganizationUncheckedUpdateWithoutMembershipsInputSchema } from "./OrganizationUncheckedUpdateWithoutMembershipsInputSchema";

export const OrganizationUpdateToOneWithWhereWithoutMembershipsInputSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutMembershipsInput> =
  z
    .object({
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => OrganizationUpdateWithoutMembershipsInputSchema),
        z.lazy(() => OrganizationUncheckedUpdateWithoutMembershipsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutMembershipsInput>;

export default OrganizationUpdateToOneWithWhereWithoutMembershipsInputSchema;
