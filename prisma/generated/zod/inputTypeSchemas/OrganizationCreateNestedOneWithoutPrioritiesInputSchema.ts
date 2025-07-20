import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateWithoutPrioritiesInputSchema } from "./OrganizationCreateWithoutPrioritiesInputSchema";
import { OrganizationUncheckedCreateWithoutPrioritiesInputSchema } from "./OrganizationUncheckedCreateWithoutPrioritiesInputSchema";
import { OrganizationCreateOrConnectWithoutPrioritiesInputSchema } from "./OrganizationCreateOrConnectWithoutPrioritiesInputSchema";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";

export const OrganizationCreateNestedOneWithoutPrioritiesInputSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutPrioritiesInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => OrganizationCreateWithoutPrioritiesInputSchema),
          z.lazy(() => OrganizationUncheckedCreateWithoutPrioritiesInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => OrganizationCreateOrConnectWithoutPrioritiesInputSchema)
        .optional(),
      connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationCreateNestedOneWithoutPrioritiesInput>;

export default OrganizationCreateNestedOneWithoutPrioritiesInputSchema;
