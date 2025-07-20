import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipCreateWithoutOrganizationInputSchema } from "./MembershipCreateWithoutOrganizationInputSchema";
import { MembershipUncheckedCreateWithoutOrganizationInputSchema } from "./MembershipUncheckedCreateWithoutOrganizationInputSchema";
import { MembershipCreateOrConnectWithoutOrganizationInputSchema } from "./MembershipCreateOrConnectWithoutOrganizationInputSchema";
import { MembershipUpsertWithWhereUniqueWithoutOrganizationInputSchema } from "./MembershipUpsertWithWhereUniqueWithoutOrganizationInputSchema";
import { MembershipCreateManyOrganizationInputEnvelopeSchema } from "./MembershipCreateManyOrganizationInputEnvelopeSchema";
import { MembershipWhereUniqueInputSchema } from "./MembershipWhereUniqueInputSchema";
import { MembershipUpdateWithWhereUniqueWithoutOrganizationInputSchema } from "./MembershipUpdateWithWhereUniqueWithoutOrganizationInputSchema";
import { MembershipUpdateManyWithWhereWithoutOrganizationInputSchema } from "./MembershipUpdateManyWithWhereWithoutOrganizationInputSchema";
import { MembershipScalarWhereInputSchema } from "./MembershipScalarWhereInputSchema";

export const MembershipUncheckedUpdateManyWithoutOrganizationNestedInputSchema: z.ZodType<Prisma.MembershipUncheckedUpdateManyWithoutOrganizationNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => MembershipCreateWithoutOrganizationInputSchema),
          z.lazy(() => MembershipCreateWithoutOrganizationInputSchema).array(),
          z.lazy(() => MembershipUncheckedCreateWithoutOrganizationInputSchema),
          z
            .lazy(() => MembershipUncheckedCreateWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => MembershipCreateOrConnectWithoutOrganizationInputSchema),
          z
            .lazy(() => MembershipCreateOrConnectWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(
            () => MembershipUpsertWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                MembershipUpsertWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => MembershipCreateManyOrganizationInputEnvelopeSchema)
        .optional(),
      set: z
        .union([
          z.lazy(() => MembershipWhereUniqueInputSchema),
          z.lazy(() => MembershipWhereUniqueInputSchema).array(),
        ])
        .optional(),
      disconnect: z
        .union([
          z.lazy(() => MembershipWhereUniqueInputSchema),
          z.lazy(() => MembershipWhereUniqueInputSchema).array(),
        ])
        .optional(),
      delete: z
        .union([
          z.lazy(() => MembershipWhereUniqueInputSchema),
          z.lazy(() => MembershipWhereUniqueInputSchema).array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => MembershipWhereUniqueInputSchema),
          z.lazy(() => MembershipWhereUniqueInputSchema).array(),
        ])
        .optional(),
      update: z
        .union([
          z.lazy(
            () => MembershipUpdateWithWhereUniqueWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () =>
                MembershipUpdateWithWhereUniqueWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(
            () => MembershipUpdateManyWithWhereWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => MembershipUpdateManyWithWhereWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      deleteMany: z
        .union([
          z.lazy(() => MembershipScalarWhereInputSchema),
          z.lazy(() => MembershipScalarWhereInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipUncheckedUpdateManyWithoutOrganizationNestedInput>;

export default MembershipUncheckedUpdateManyWithoutOrganizationNestedInputSchema;
