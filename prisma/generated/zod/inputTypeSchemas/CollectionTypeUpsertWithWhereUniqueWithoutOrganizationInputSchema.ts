import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CollectionTypeWhereUniqueInputSchema } from "./CollectionTypeWhereUniqueInputSchema";
import { CollectionTypeUpdateWithoutOrganizationInputSchema } from "./CollectionTypeUpdateWithoutOrganizationInputSchema";
import { CollectionTypeUncheckedUpdateWithoutOrganizationInputSchema } from "./CollectionTypeUncheckedUpdateWithoutOrganizationInputSchema";
import { CollectionTypeCreateWithoutOrganizationInputSchema } from "./CollectionTypeCreateWithoutOrganizationInputSchema";
import { CollectionTypeUncheckedCreateWithoutOrganizationInputSchema } from "./CollectionTypeUncheckedCreateWithoutOrganizationInputSchema";

export const CollectionTypeUpsertWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.CollectionTypeUpsertWithWhereUniqueWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => CollectionTypeWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => CollectionTypeUpdateWithoutOrganizationInputSchema),
        z.lazy(
          () => CollectionTypeUncheckedUpdateWithoutOrganizationInputSchema,
        ),
      ]),
      create: z.union([
        z.lazy(() => CollectionTypeCreateWithoutOrganizationInputSchema),
        z.lazy(
          () => CollectionTypeUncheckedCreateWithoutOrganizationInputSchema,
        ),
      ]),
    })
    .strict() as z.ZodType<Prisma.CollectionTypeUpsertWithWhereUniqueWithoutOrganizationInput>;

export default CollectionTypeUpsertWithWhereUniqueWithoutOrganizationInputSchema;
