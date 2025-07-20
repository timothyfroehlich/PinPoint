import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";
import { OrganizationUpdateWithoutLocationsInputSchema } from "./OrganizationUpdateWithoutLocationsInputSchema";
import { OrganizationUncheckedUpdateWithoutLocationsInputSchema } from "./OrganizationUncheckedUpdateWithoutLocationsInputSchema";

export const OrganizationUpdateToOneWithWhereWithoutLocationsInputSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutLocationsInput> =
  z
    .object({
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => OrganizationUpdateWithoutLocationsInputSchema),
        z.lazy(() => OrganizationUncheckedUpdateWithoutLocationsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutLocationsInput>;

export default OrganizationUpdateToOneWithWhereWithoutLocationsInputSchema;
