import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PinballMapConfigCreateWithoutOrganizationInputSchema } from "./PinballMapConfigCreateWithoutOrganizationInputSchema";
import { PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema } from "./PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema";
import { PinballMapConfigCreateOrConnectWithoutOrganizationInputSchema } from "./PinballMapConfigCreateOrConnectWithoutOrganizationInputSchema";
import { PinballMapConfigUpsertWithoutOrganizationInputSchema } from "./PinballMapConfigUpsertWithoutOrganizationInputSchema";
import { PinballMapConfigWhereInputSchema } from "./PinballMapConfigWhereInputSchema";
import { PinballMapConfigWhereUniqueInputSchema } from "./PinballMapConfigWhereUniqueInputSchema";
import { PinballMapConfigUpdateToOneWithWhereWithoutOrganizationInputSchema } from "./PinballMapConfigUpdateToOneWithWhereWithoutOrganizationInputSchema";
import { PinballMapConfigUpdateWithoutOrganizationInputSchema } from "./PinballMapConfigUpdateWithoutOrganizationInputSchema";
import { PinballMapConfigUncheckedUpdateWithoutOrganizationInputSchema } from "./PinballMapConfigUncheckedUpdateWithoutOrganizationInputSchema";

export const PinballMapConfigUncheckedUpdateOneWithoutOrganizationNestedInputSchema: z.ZodType<Prisma.PinballMapConfigUncheckedUpdateOneWithoutOrganizationNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => PinballMapConfigCreateWithoutOrganizationInputSchema),
          z.lazy(
            () => PinballMapConfigUncheckedCreateWithoutOrganizationInputSchema,
          ),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(
          () => PinballMapConfigCreateOrConnectWithoutOrganizationInputSchema,
        )
        .optional(),
      upsert: z
        .lazy(() => PinballMapConfigUpsertWithoutOrganizationInputSchema)
        .optional(),
      disconnect: z
        .union([z.boolean(), z.lazy(() => PinballMapConfigWhereInputSchema)])
        .optional(),
      delete: z
        .union([z.boolean(), z.lazy(() => PinballMapConfigWhereInputSchema)])
        .optional(),
      connect: z.lazy(() => PinballMapConfigWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(
            () =>
              PinballMapConfigUpdateToOneWithWhereWithoutOrganizationInputSchema,
          ),
          z.lazy(() => PinballMapConfigUpdateWithoutOrganizationInputSchema),
          z.lazy(
            () => PinballMapConfigUncheckedUpdateWithoutOrganizationInputSchema,
          ),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigUncheckedUpdateOneWithoutOrganizationNestedInput>;

export default PinballMapConfigUncheckedUpdateOneWithoutOrganizationNestedInputSchema;
