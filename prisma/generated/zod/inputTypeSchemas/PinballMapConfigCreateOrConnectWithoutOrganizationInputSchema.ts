import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PinballMapConfigWhereUniqueInputSchema } from "./PinballMapConfigWhereUniqueInputSchema";
import { PinballMapConfigCreateWithoutOrganizationInputSchema } from "./PinballMapConfigCreateWithoutOrganizationInputSchema";
import { PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema } from "./PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema";

export const PinballMapConfigCreateOrConnectWithoutOrganizationInputSchema: z.ZodType<Prisma.PinballMapConfigCreateOrConnectWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => PinballMapConfigWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => PinballMapConfigCreateWithoutOrganizationInputSchema),
        z.lazy(
          () => PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema,
        ),
      ]),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigCreateOrConnectWithoutOrganizationInput>;

export default PinballMapConfigCreateOrConnectWithoutOrganizationInputSchema;
