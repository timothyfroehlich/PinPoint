import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateWithoutMembershipsInputSchema } from "./OrganizationCreateWithoutMembershipsInputSchema";
import { OrganizationUncheckedCreateWithoutMembershipsInputSchema } from "./OrganizationUncheckedCreateWithoutMembershipsInputSchema";
import { OrganizationCreateOrConnectWithoutMembershipsInputSchema } from "./OrganizationCreateOrConnectWithoutMembershipsInputSchema";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";

export const OrganizationCreateNestedOneWithoutMembershipsInputSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutMembershipsInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => OrganizationCreateWithoutMembershipsInputSchema),
          z.lazy(
            () => OrganizationUncheckedCreateWithoutMembershipsInputSchema,
          ),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => OrganizationCreateOrConnectWithoutMembershipsInputSchema)
        .optional(),
      connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationCreateNestedOneWithoutMembershipsInput>;

export default OrganizationCreateNestedOneWithoutMembershipsInputSchema;
