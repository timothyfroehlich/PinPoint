import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserCreateWithoutUpvotesInputSchema } from "./UserCreateWithoutUpvotesInputSchema";
import { UserUncheckedCreateWithoutUpvotesInputSchema } from "./UserUncheckedCreateWithoutUpvotesInputSchema";
import { UserCreateOrConnectWithoutUpvotesInputSchema } from "./UserCreateOrConnectWithoutUpvotesInputSchema";
import { UserUpsertWithoutUpvotesInputSchema } from "./UserUpsertWithoutUpvotesInputSchema";
import { UserWhereUniqueInputSchema } from "./UserWhereUniqueInputSchema";
import { UserUpdateToOneWithWhereWithoutUpvotesInputSchema } from "./UserUpdateToOneWithWhereWithoutUpvotesInputSchema";
import { UserUpdateWithoutUpvotesInputSchema } from "./UserUpdateWithoutUpvotesInputSchema";
import { UserUncheckedUpdateWithoutUpvotesInputSchema } from "./UserUncheckedUpdateWithoutUpvotesInputSchema";

export const UserUpdateOneRequiredWithoutUpvotesNestedInputSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutUpvotesNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => UserCreateWithoutUpvotesInputSchema),
          z.lazy(() => UserUncheckedCreateWithoutUpvotesInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => UserCreateOrConnectWithoutUpvotesInputSchema)
        .optional(),
      upsert: z.lazy(() => UserUpsertWithoutUpvotesInputSchema).optional(),
      connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(() => UserUpdateToOneWithWhereWithoutUpvotesInputSchema),
          z.lazy(() => UserUpdateWithoutUpvotesInputSchema),
          z.lazy(() => UserUncheckedUpdateWithoutUpvotesInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.UserUpdateOneRequiredWithoutUpvotesNestedInput>;

export default UserUpdateOneRequiredWithoutUpvotesNestedInputSchema;
