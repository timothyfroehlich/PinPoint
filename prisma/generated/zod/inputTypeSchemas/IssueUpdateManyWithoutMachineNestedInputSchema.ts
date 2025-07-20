import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateWithoutMachineInputSchema } from "./IssueCreateWithoutMachineInputSchema";
import { IssueUncheckedCreateWithoutMachineInputSchema } from "./IssueUncheckedCreateWithoutMachineInputSchema";
import { IssueCreateOrConnectWithoutMachineInputSchema } from "./IssueCreateOrConnectWithoutMachineInputSchema";
import { IssueUpsertWithWhereUniqueWithoutMachineInputSchema } from "./IssueUpsertWithWhereUniqueWithoutMachineInputSchema";
import { IssueCreateManyMachineInputEnvelopeSchema } from "./IssueCreateManyMachineInputEnvelopeSchema";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateWithWhereUniqueWithoutMachineInputSchema } from "./IssueUpdateWithWhereUniqueWithoutMachineInputSchema";
import { IssueUpdateManyWithWhereWithoutMachineInputSchema } from "./IssueUpdateManyWithWhereWithoutMachineInputSchema";
import { IssueScalarWhereInputSchema } from "./IssueScalarWhereInputSchema";

export const IssueUpdateManyWithoutMachineNestedInputSchema: z.ZodType<Prisma.IssueUpdateManyWithoutMachineNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueCreateWithoutMachineInputSchema),
          z.lazy(() => IssueCreateWithoutMachineInputSchema).array(),
          z.lazy(() => IssueUncheckedCreateWithoutMachineInputSchema),
          z.lazy(() => IssueUncheckedCreateWithoutMachineInputSchema).array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => IssueCreateOrConnectWithoutMachineInputSchema),
          z.lazy(() => IssueCreateOrConnectWithoutMachineInputSchema).array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(() => IssueUpsertWithWhereUniqueWithoutMachineInputSchema),
          z
            .lazy(() => IssueUpsertWithWhereUniqueWithoutMachineInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => IssueCreateManyMachineInputEnvelopeSchema)
        .optional(),
      set: z
        .union([
          z.lazy(() => IssueWhereUniqueInputSchema),
          z.lazy(() => IssueWhereUniqueInputSchema).array(),
        ])
        .optional(),
      disconnect: z
        .union([
          z.lazy(() => IssueWhereUniqueInputSchema),
          z.lazy(() => IssueWhereUniqueInputSchema).array(),
        ])
        .optional(),
      delete: z
        .union([
          z.lazy(() => IssueWhereUniqueInputSchema),
          z.lazy(() => IssueWhereUniqueInputSchema).array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => IssueWhereUniqueInputSchema),
          z.lazy(() => IssueWhereUniqueInputSchema).array(),
        ])
        .optional(),
      update: z
        .union([
          z.lazy(() => IssueUpdateWithWhereUniqueWithoutMachineInputSchema),
          z
            .lazy(() => IssueUpdateWithWhereUniqueWithoutMachineInputSchema)
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(() => IssueUpdateManyWithWhereWithoutMachineInputSchema),
          z
            .lazy(() => IssueUpdateManyWithWhereWithoutMachineInputSchema)
            .array(),
        ])
        .optional(),
      deleteMany: z
        .union([
          z.lazy(() => IssueScalarWhereInputSchema),
          z.lazy(() => IssueScalarWhereInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateManyWithoutMachineNestedInput>;

export default IssueUpdateManyWithoutMachineNestedInputSchema;
