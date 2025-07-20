import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserUpdateWithoutUpvotesInputSchema } from "./UserUpdateWithoutUpvotesInputSchema";
import { UserUncheckedUpdateWithoutUpvotesInputSchema } from "./UserUncheckedUpdateWithoutUpvotesInputSchema";
import { UserCreateWithoutUpvotesInputSchema } from "./UserCreateWithoutUpvotesInputSchema";
import { UserUncheckedCreateWithoutUpvotesInputSchema } from "./UserUncheckedCreateWithoutUpvotesInputSchema";
import { UserWhereInputSchema } from "./UserWhereInputSchema";

export const UserUpsertWithoutUpvotesInputSchema: z.ZodType<Prisma.UserUpsertWithoutUpvotesInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => UserUpdateWithoutUpvotesInputSchema),
        z.lazy(() => UserUncheckedUpdateWithoutUpvotesInputSchema),
      ]),
      create: z.union([
        z.lazy(() => UserCreateWithoutUpvotesInputSchema),
        z.lazy(() => UserUncheckedCreateWithoutUpvotesInputSchema),
      ]),
      where: z.lazy(() => UserWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.UserUpsertWithoutUpvotesInput>;

export default UserUpsertWithoutUpvotesInputSchema;
