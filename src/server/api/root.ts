import { organizationRouter } from "./routers/organization";

import { collectionRouter } from "~/server/api/routers/collection";
import { commentRouter } from "~/server/api/routers/comment";
import { issueRouter } from "~/server/api/routers/issue";
import { locationRouter } from "~/server/api/routers/location";
import { machineRouter } from "~/server/api/routers/machine";
import { modelRouter } from "~/server/api/routers/model";
import { notificationRouter } from "~/server/api/routers/notification";
import { qrCodeRouter } from "~/server/api/routers/qrCode";
import { userRouter } from "~/server/api/routers/user";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  collection: collectionRouter,
  comment: commentRouter,
  model: modelRouter,
  location: locationRouter,
  machine: machineRouter,
  user: userRouter,
  issue: issueRouter,
  organization: organizationRouter,
  notification: notificationRouter,
  qrCode: qrCodeRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
