import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UpvoteWhereUniqueInputSchema } from "./UpvoteWhereUniqueInputSchema";
import { UpvoteUpdateWithoutIssueInputSchema } from "./UpvoteUpdateWithoutIssueInputSchema";
import { UpvoteUncheckedUpdateWithoutIssueInputSchema } from "./UpvoteUncheckedUpdateWithoutIssueInputSchema";
import { UpvoteCreateWithoutIssueInputSchema } from "./UpvoteCreateWithoutIssueInputSchema";
import { UpvoteUncheckedCreateWithoutIssueInputSchema } from "./UpvoteUncheckedCreateWithoutIssueInputSchema";

export const UpvoteUpsertWithWhereUniqueWithoutIssueInputSchema: z.ZodType<Prisma.UpvoteUpsertWithWhereUniqueWithoutIssueInput> =
  z
    .object({
      where: z.lazy(() => UpvoteWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => UpvoteUpdateWithoutIssueInputSchema),
        z.lazy(() => UpvoteUncheckedUpdateWithoutIssueInputSchema),
      ]),
      create: z.union([
        z.lazy(() => UpvoteCreateWithoutIssueInputSchema),
        z.lazy(() => UpvoteUncheckedCreateWithoutIssueInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UpvoteUpsertWithWhereUniqueWithoutIssueInput>;

export default UpvoteUpsertWithWhereUniqueWithoutIssueInputSchema;
