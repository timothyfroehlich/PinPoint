import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PinballMapConfigUpdateWithoutOrganizationInputSchema } from "./PinballMapConfigUpdateWithoutOrganizationInputSchema";
import { PinballMapConfigUncheckedUpdateWithoutOrganizationInputSchema } from "./PinballMapConfigUncheckedUpdateWithoutOrganizationInputSchema";
import { PinballMapConfigCreateWithoutOrganizationInputSchema } from "./PinballMapConfigCreateWithoutOrganizationInputSchema";
import { PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema } from "./PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema";
import { PinballMapConfigWhereInputSchema } from "./PinballMapConfigWhereInputSchema";

export const PinballMapConfigUpsertWithoutOrganizationInputSchema: z.ZodType<Prisma.PinballMapConfigUpsertWithoutOrganizationInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => PinballMapConfigUpdateWithoutOrganizationInputSchema),
        z.lazy(
          () => PinballMapConfigUncheckedUpdateWithoutOrganizationInputSchema,
        ),
      ]),
      create: z.union([
        z.lazy(() => PinballMapConfigCreateWithoutOrganizationInputSchema),
        z.lazy(
          () => PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema,
        ),
      ]),
      where: z.lazy(() => PinballMapConfigWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigUpsertWithoutOrganizationInput>;

export default PinballMapConfigUpsertWithoutOrganizationInputSchema;
