import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { RoleCreateManyOrganizationInputSchema } from "./RoleCreateManyOrganizationInputSchema";

export const RoleCreateManyOrganizationInputEnvelopeSchema: z.ZodType<Prisma.RoleCreateManyOrganizationInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => RoleCreateManyOrganizationInputSchema),
        z.lazy(() => RoleCreateManyOrganizationInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.RoleCreateManyOrganizationInputEnvelope>;

export default RoleCreateManyOrganizationInputEnvelopeSchema;
