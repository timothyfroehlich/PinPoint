/**
 * Next.js Instrumentation
 * Runs once when the server starts (Node.js runtime only)
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { getLogger } from "~/lib/logger";

export async function register() {
  // Only run on Node.js runtime (not Edge)
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    try {
      const logger = await getLogger();
      logger.info(
        {
          nodeEnv: process.env.NODE_ENV,
          nodeVersion: process.version,
          nextVersion: require("next/package.json").version,
        },
        "PinPoint server starting"
      );
    } catch (error) {
      console.error("Failed to initialize logger:", error);
    }
  }
}
