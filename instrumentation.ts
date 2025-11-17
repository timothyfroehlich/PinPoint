/**
 * Next.js Instrumentation
 * Runs once when the server starts (Node.js runtime only)
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register(): Promise<void> {
  // Only run on Node.js runtime (not Edge)
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    try {
      // Dynamic import to avoid Edge Runtime compatibility issues
      const { getLogger } = await import("~/lib/logger");
      const logger = await getLogger();
      logger.info(
        {
          nodeEnv: process.env.NODE_ENV,
          nodeVersion: process.version,
        },
        "PinPoint server starting"
      );
    } catch (error) {
      console.error("Failed to initialize logger:", error);
    }
  }
}
