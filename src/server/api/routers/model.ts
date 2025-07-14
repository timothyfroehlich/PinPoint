import { modelCoreRouter } from "./model.core";

import { createTRPCRouter } from "~/server/api/trpc";

export const modelRouter = createTRPCRouter({
  ...modelCoreRouter,
});
