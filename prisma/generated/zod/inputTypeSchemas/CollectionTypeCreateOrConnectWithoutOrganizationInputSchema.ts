import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CollectionTypeWhereUniqueInputSchema } from "./CollectionTypeWhereUniqueInputSchema";
import { CollectionTypeCreateWithoutOrganizationInputSchema } from "./CollectionTypeCreateWithoutOrganizationInputSchema";
import { CollectionTypeUncheckedCreateWithoutOrganizationInputSchema } from "./CollectionTypeUncheckedCreateWithoutOrganizationInputSchema";

export const CollectionTypeCreateOrConnectWithoutOrganizationInputSchema: z.ZodType<Prisma.CollectionTypeCreateOrConnectWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => CollectionTypeWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => CollectionTypeCreateWithoutOrganizationInputSchema),
        z.lazy(
          () => CollectionTypeUncheckedCreateWithoutOrganizationInputSchema,
        ),
      ]),
    })
    .strict() as z.ZodType<Prisma.CollectionTypeCreateOrConnectWithoutOrganizationInput>;

export default CollectionTypeCreateOrConnectWithoutOrganizationInputSchema;
