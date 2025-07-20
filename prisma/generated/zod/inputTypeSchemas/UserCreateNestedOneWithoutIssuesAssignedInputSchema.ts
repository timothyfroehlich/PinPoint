import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserCreateWithoutIssuesAssignedInputSchema } from "./UserCreateWithoutIssuesAssignedInputSchema";
import { UserUncheckedCreateWithoutIssuesAssignedInputSchema } from "./UserUncheckedCreateWithoutIssuesAssignedInputSchema";
import { UserCreateOrConnectWithoutIssuesAssignedInputSchema } from "./UserCreateOrConnectWithoutIssuesAssignedInputSchema";
import { UserWhereUniqueInputSchema } from "./UserWhereUniqueInputSchema";

export const UserCreateNestedOneWithoutIssuesAssignedInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutIssuesAssignedInput> =
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
      connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.UserCreateNestedOneWithoutIssuesAssignedInput>;

export default UserCreateNestedOneWithoutIssuesAssignedInputSchema;
