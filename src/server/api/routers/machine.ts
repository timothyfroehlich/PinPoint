import { machineCoreRouter } from "./machine.core";

import { createTRPCRouter } from "~/server/api/trpc";

export const machineRouter = createTRPCRouter({
  ...machineCoreRouter,
});
