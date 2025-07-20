import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PriorityWhereUniqueInputSchema } from "./PriorityWhereUniqueInputSchema";
import { PriorityCreateWithoutOrganizationInputSchema } from "./PriorityCreateWithoutOrganizationInputSchema";
import { PriorityUncheckedCreateWithoutOrganizationInputSchema } from "./PriorityUncheckedCreateWithoutOrganizationInputSchema";

export const PriorityCreateOrConnectWithoutOrganizationInputSchema: z.ZodType<Prisma.PriorityCreateOrConnectWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => PriorityWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => PriorityCreateWithoutOrganizationInputSchema),
        z.lazy(() => PriorityUncheckedCreateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.PriorityCreateOrConnectWithoutOrganizationInput>;

export default PriorityCreateOrConnectWithoutOrganizationInputSchema;
