import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PriorityWhereUniqueInputSchema } from "./PriorityWhereUniqueInputSchema";
import { PriorityUpdateWithoutOrganizationInputSchema } from "./PriorityUpdateWithoutOrganizationInputSchema";
import { PriorityUncheckedUpdateWithoutOrganizationInputSchema } from "./PriorityUncheckedUpdateWithoutOrganizationInputSchema";
import { PriorityCreateWithoutOrganizationInputSchema } from "./PriorityCreateWithoutOrganizationInputSchema";
import { PriorityUncheckedCreateWithoutOrganizationInputSchema } from "./PriorityUncheckedCreateWithoutOrganizationInputSchema";

export const PriorityUpsertWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.PriorityUpsertWithWhereUniqueWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => PriorityWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => PriorityUpdateWithoutOrganizationInputSchema),
        z.lazy(() => PriorityUncheckedUpdateWithoutOrganizationInputSchema),
      ]),
      create: z.union([
        z.lazy(() => PriorityCreateWithoutOrganizationInputSchema),
        z.lazy(() => PriorityUncheckedCreateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.PriorityUpsertWithWhereUniqueWithoutOrganizationInput>;

export default PriorityUpsertWithWhereUniqueWithoutOrganizationInputSchema;
