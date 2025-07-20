import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationUpdateWithoutPrioritiesInputSchema } from "./OrganizationUpdateWithoutPrioritiesInputSchema";
import { OrganizationUncheckedUpdateWithoutPrioritiesInputSchema } from "./OrganizationUncheckedUpdateWithoutPrioritiesInputSchema";
import { OrganizationCreateWithoutPrioritiesInputSchema } from "./OrganizationCreateWithoutPrioritiesInputSchema";
import { OrganizationUncheckedCreateWithoutPrioritiesInputSchema } from "./OrganizationUncheckedCreateWithoutPrioritiesInputSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";

export const OrganizationUpsertWithoutPrioritiesInputSchema: z.ZodType<Prisma.OrganizationUpsertWithoutPrioritiesInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => OrganizationUpdateWithoutPrioritiesInputSchema),
        z.lazy(() => OrganizationUncheckedUpdateWithoutPrioritiesInputSchema),
      ]),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutPrioritiesInputSchema),
        z.lazy(() => OrganizationUncheckedCreateWithoutPrioritiesInputSchema),
      ]),
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpsertWithoutPrioritiesInput>;

export default OrganizationUpsertWithoutPrioritiesInputSchema;
