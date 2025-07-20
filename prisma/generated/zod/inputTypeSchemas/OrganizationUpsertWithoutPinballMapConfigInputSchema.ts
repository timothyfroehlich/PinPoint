import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationUpdateWithoutPinballMapConfigInputSchema } from "./OrganizationUpdateWithoutPinballMapConfigInputSchema";
import { OrganizationUncheckedUpdateWithoutPinballMapConfigInputSchema } from "./OrganizationUncheckedUpdateWithoutPinballMapConfigInputSchema";
import { OrganizationCreateWithoutPinballMapConfigInputSchema } from "./OrganizationCreateWithoutPinballMapConfigInputSchema";
import { OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema } from "./OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";

export const OrganizationUpsertWithoutPinballMapConfigInputSchema: z.ZodType<Prisma.OrganizationUpsertWithoutPinballMapConfigInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => OrganizationUpdateWithoutPinballMapConfigInputSchema),
        z.lazy(
          () => OrganizationUncheckedUpdateWithoutPinballMapConfigInputSchema,
        ),
      ]),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutPinballMapConfigInputSchema),
        z.lazy(
          () => OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema,
        ),
      ]),
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpsertWithoutPinballMapConfigInput>;

export default OrganizationUpsertWithoutPinballMapConfigInputSchema;
