import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";
import { OrganizationCreateWithoutMembershipsInputSchema } from "./OrganizationCreateWithoutMembershipsInputSchema";
import { OrganizationUncheckedCreateWithoutMembershipsInputSchema } from "./OrganizationUncheckedCreateWithoutMembershipsInputSchema";

export const OrganizationCreateOrConnectWithoutMembershipsInputSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutMembershipsInput> =
  z
    .object({
      where: z.lazy(() => OrganizationWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutMembershipsInputSchema),
        z.lazy(() => OrganizationUncheckedCreateWithoutMembershipsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.OrganizationCreateOrConnectWithoutMembershipsInput>;

export default OrganizationCreateOrConnectWithoutMembershipsInputSchema;
