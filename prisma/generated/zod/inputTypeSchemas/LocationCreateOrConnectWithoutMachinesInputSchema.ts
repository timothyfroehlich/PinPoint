import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { LocationWhereUniqueInputSchema } from "./LocationWhereUniqueInputSchema";
import { LocationCreateWithoutMachinesInputSchema } from "./LocationCreateWithoutMachinesInputSchema";
import { LocationUncheckedCreateWithoutMachinesInputSchema } from "./LocationUncheckedCreateWithoutMachinesInputSchema";

export const LocationCreateOrConnectWithoutMachinesInputSchema: z.ZodType<Prisma.LocationCreateOrConnectWithoutMachinesInput> =
  z
    .object({
      where: z.lazy(() => LocationWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => LocationCreateWithoutMachinesInputSchema),
        z.lazy(() => LocationUncheckedCreateWithoutMachinesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.LocationCreateOrConnectWithoutMachinesInput>;

export default LocationCreateOrConnectWithoutMachinesInputSchema;
