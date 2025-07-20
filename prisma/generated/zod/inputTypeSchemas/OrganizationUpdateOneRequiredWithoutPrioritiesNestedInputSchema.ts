import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateWithoutPrioritiesInputSchema } from "./OrganizationCreateWithoutPrioritiesInputSchema";
import { OrganizationUncheckedCreateWithoutPrioritiesInputSchema } from "./OrganizationUncheckedCreateWithoutPrioritiesInputSchema";
import { OrganizationCreateOrConnectWithoutPrioritiesInputSchema } from "./OrganizationCreateOrConnectWithoutPrioritiesInputSchema";
import { OrganizationUpsertWithoutPrioritiesInputSchema } from "./OrganizationUpsertWithoutPrioritiesInputSchema";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";
import { OrganizationUpdateToOneWithWhereWithoutPrioritiesInputSchema } from "./OrganizationUpdateToOneWithWhereWithoutPrioritiesInputSchema";
import { OrganizationUpdateWithoutPrioritiesInputSchema } from "./OrganizationUpdateWithoutPrioritiesInputSchema";
import { OrganizationUncheckedUpdateWithoutPrioritiesInputSchema } from "./OrganizationUncheckedUpdateWithoutPrioritiesInputSchema";

export const OrganizationUpdateOneRequiredWithoutPrioritiesNestedInputSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutPrioritiesNestedInput> =
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
      upsert: z
        .lazy(() => OrganizationUpsertWithoutPrioritiesInputSchema)
        .optional(),
      connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(
            () => OrganizationUpdateToOneWithWhereWithoutPrioritiesInputSchema,
          ),
          z.lazy(() => OrganizationUpdateWithoutPrioritiesInputSchema),
          z.lazy(() => OrganizationUncheckedUpdateWithoutPrioritiesInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutPrioritiesNestedInput>;

export default OrganizationUpdateOneRequiredWithoutPrioritiesNestedInputSchema;
