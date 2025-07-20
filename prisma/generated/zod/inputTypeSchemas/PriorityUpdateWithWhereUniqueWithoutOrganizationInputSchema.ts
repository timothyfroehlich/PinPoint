import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PriorityWhereUniqueInputSchema } from "./PriorityWhereUniqueInputSchema";
import { PriorityUpdateWithoutOrganizationInputSchema } from "./PriorityUpdateWithoutOrganizationInputSchema";
import { PriorityUncheckedUpdateWithoutOrganizationInputSchema } from "./PriorityUncheckedUpdateWithoutOrganizationInputSchema";

export const PriorityUpdateWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.PriorityUpdateWithWhereUniqueWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => PriorityWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => PriorityUpdateWithoutOrganizationInputSchema),
        z.lazy(() => PriorityUncheckedUpdateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.PriorityUpdateWithWhereUniqueWithoutOrganizationInput>;

export default PriorityUpdateWithWhereUniqueWithoutOrganizationInputSchema;
