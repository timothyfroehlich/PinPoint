import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationUpdateWithoutMembershipsInputSchema } from "./OrganizationUpdateWithoutMembershipsInputSchema";
import { OrganizationUncheckedUpdateWithoutMembershipsInputSchema } from "./OrganizationUncheckedUpdateWithoutMembershipsInputSchema";
import { OrganizationCreateWithoutMembershipsInputSchema } from "./OrganizationCreateWithoutMembershipsInputSchema";
import { OrganizationUncheckedCreateWithoutMembershipsInputSchema } from "./OrganizationUncheckedCreateWithoutMembershipsInputSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";

export const OrganizationUpsertWithoutMembershipsInputSchema: z.ZodType<Prisma.OrganizationUpsertWithoutMembershipsInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => OrganizationUpdateWithoutMembershipsInputSchema),
        z.lazy(() => OrganizationUncheckedUpdateWithoutMembershipsInputSchema),
      ]),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutMembershipsInputSchema),
        z.lazy(() => OrganizationUncheckedCreateWithoutMembershipsInputSchema),
      ]),
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpsertWithoutMembershipsInput>;

export default OrganizationUpsertWithoutMembershipsInputSchema;
