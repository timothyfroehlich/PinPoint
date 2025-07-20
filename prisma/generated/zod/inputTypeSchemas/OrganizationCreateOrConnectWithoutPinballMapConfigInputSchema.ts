import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";
import { OrganizationCreateWithoutPinballMapConfigInputSchema } from "./OrganizationCreateWithoutPinballMapConfigInputSchema";
import { OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema } from "./OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema";

export const OrganizationCreateOrConnectWithoutPinballMapConfigInputSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutPinballMapConfigInput> =
  z
    .object({
      where: z.lazy(() => OrganizationWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutPinballMapConfigInputSchema),
        z.lazy(
          () => OrganizationUncheckedCreateWithoutPinballMapConfigInputSchema,
        ),
      ]),
    })
    .strict() as z.ZodType<Prisma.OrganizationCreateOrConnectWithoutPinballMapConfigInput>;

export default OrganizationCreateOrConnectWithoutPinballMapConfigInputSchema;
