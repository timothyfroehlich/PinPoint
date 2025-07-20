import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateWithoutLocationsInputSchema } from "./OrganizationCreateWithoutLocationsInputSchema";
import { OrganizationUncheckedCreateWithoutLocationsInputSchema } from "./OrganizationUncheckedCreateWithoutLocationsInputSchema";
import { OrganizationCreateOrConnectWithoutLocationsInputSchema } from "./OrganizationCreateOrConnectWithoutLocationsInputSchema";
import { OrganizationUpsertWithoutLocationsInputSchema } from "./OrganizationUpsertWithoutLocationsInputSchema";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";
import { OrganizationUpdateToOneWithWhereWithoutLocationsInputSchema } from "./OrganizationUpdateToOneWithWhereWithoutLocationsInputSchema";
import { OrganizationUpdateWithoutLocationsInputSchema } from "./OrganizationUpdateWithoutLocationsInputSchema";
import { OrganizationUncheckedUpdateWithoutLocationsInputSchema } from "./OrganizationUncheckedUpdateWithoutLocationsInputSchema";

export const OrganizationUpdateOneRequiredWithoutLocationsNestedInputSchema: z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutLocationsNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => OrganizationCreateWithoutLocationsInputSchema),
          z.lazy(() => OrganizationUncheckedCreateWithoutLocationsInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => OrganizationCreateOrConnectWithoutLocationsInputSchema)
        .optional(),
      upsert: z
        .lazy(() => OrganizationUpsertWithoutLocationsInputSchema)
        .optional(),
      connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(
            () => OrganizationUpdateToOneWithWhereWithoutLocationsInputSchema,
          ),
          z.lazy(() => OrganizationUpdateWithoutLocationsInputSchema),
          z.lazy(() => OrganizationUncheckedUpdateWithoutLocationsInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpdateOneRequiredWithoutLocationsNestedInput>;

export default OrganizationUpdateOneRequiredWithoutLocationsNestedInputSchema;
