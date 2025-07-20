import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PinballMapConfigWhereInputSchema } from "./PinballMapConfigWhereInputSchema";
import { PinballMapConfigUpdateWithoutOrganizationInputSchema } from "./PinballMapConfigUpdateWithoutOrganizationInputSchema";
import { PinballMapConfigUncheckedUpdateWithoutOrganizationInputSchema } from "./PinballMapConfigUncheckedUpdateWithoutOrganizationInputSchema";

export const PinballMapConfigUpdateToOneWithWhereWithoutOrganizationInputSchema: z.ZodType<Prisma.PinballMapConfigUpdateToOneWithWhereWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => PinballMapConfigWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => PinballMapConfigUpdateWithoutOrganizationInputSchema),
        z.lazy(
          () => PinballMapConfigUncheckedUpdateWithoutOrganizationInputSchema,
        ),
      ]),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigUpdateToOneWithWhereWithoutOrganizationInput>;

export default PinballMapConfigUpdateToOneWithWhereWithoutOrganizationInputSchema;
