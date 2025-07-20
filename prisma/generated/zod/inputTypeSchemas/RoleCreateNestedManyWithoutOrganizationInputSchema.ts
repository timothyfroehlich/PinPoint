import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { RoleCreateWithoutOrganizationInputSchema } from "./RoleCreateWithoutOrganizationInputSchema";
import { RoleUncheckedCreateWithoutOrganizationInputSchema } from "./RoleUncheckedCreateWithoutOrganizationInputSchema";
import { RoleCreateOrConnectWithoutOrganizationInputSchema } from "./RoleCreateOrConnectWithoutOrganizationInputSchema";
import { RoleCreateManyOrganizationInputEnvelopeSchema } from "./RoleCreateManyOrganizationInputEnvelopeSchema";
import { RoleWhereUniqueInputSchema } from "./RoleWhereUniqueInputSchema";

export const RoleCreateNestedManyWithoutOrganizationInputSchema: z.ZodType<Prisma.RoleCreateNestedManyWithoutOrganizationInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => RoleCreateWithoutOrganizationInputSchema),
          z.lazy(() => RoleCreateWithoutOrganizationInputSchema).array(),
          z.lazy(() => RoleUncheckedCreateWithoutOrganizationInputSchema),
          z
            .lazy(() => RoleUncheckedCreateWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => RoleCreateOrConnectWithoutOrganizationInputSchema),
          z
            .lazy(() => RoleCreateOrConnectWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => RoleCreateManyOrganizationInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => RoleWhereUniqueInputSchema),
          z.lazy(() => RoleWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.RoleCreateNestedManyWithoutOrganizationInput>;

export default RoleCreateNestedManyWithoutOrganizationInputSchema;
