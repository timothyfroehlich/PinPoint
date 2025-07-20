import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserCreateWithoutIssuesAssignedInputSchema } from "./UserCreateWithoutIssuesAssignedInputSchema";
import { UserUncheckedCreateWithoutIssuesAssignedInputSchema } from "./UserUncheckedCreateWithoutIssuesAssignedInputSchema";
import { UserCreateOrConnectWithoutIssuesAssignedInputSchema } from "./UserCreateOrConnectWithoutIssuesAssignedInputSchema";
import { UserUpsertWithoutIssuesAssignedInputSchema } from "./UserUpsertWithoutIssuesAssignedInputSchema";
import { UserWhereInputSchema } from "./UserWhereInputSchema";
import { UserWhereUniqueInputSchema } from "./UserWhereUniqueInputSchema";
import { UserUpdateToOneWithWhereWithoutIssuesAssignedInputSchema } from "./UserUpdateToOneWithWhereWithoutIssuesAssignedInputSchema";
import { UserUpdateWithoutIssuesAssignedInputSchema } from "./UserUpdateWithoutIssuesAssignedInputSchema";
import { UserUncheckedUpdateWithoutIssuesAssignedInputSchema } from "./UserUncheckedUpdateWithoutIssuesAssignedInputSchema";

export const UserUpdateOneWithoutIssuesAssignedNestedInputSchema: z.ZodType<Prisma.UserUpdateOneWithoutIssuesAssignedNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => UserCreateWithoutIssuesAssignedInputSchema),
          z.lazy(() => UserUncheckedCreateWithoutIssuesAssignedInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => UserCreateOrConnectWithoutIssuesAssignedInputSchema)
        .optional(),
      upsert: z
        .lazy(() => UserUpsertWithoutIssuesAssignedInputSchema)
        .optional(),
      disconnect: z
        .union([z.boolean(), z.lazy(() => UserWhereInputSchema)])
        .optional(),
      delete: z
        .union([z.boolean(), z.lazy(() => UserWhereInputSchema)])
        .optional(),
      connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(
            () => UserUpdateToOneWithWhereWithoutIssuesAssignedInputSchema,
          ),
          z.lazy(() => UserUpdateWithoutIssuesAssignedInputSchema),
          z.lazy(() => UserUncheckedUpdateWithoutIssuesAssignedInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.UserUpdateOneWithoutIssuesAssignedNestedInput>;

export default UserUpdateOneWithoutIssuesAssignedNestedInputSchema;
