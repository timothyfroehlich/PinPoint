// This file is used to load Sentry instrumentation before Next.js starts
export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env["NEXT_RUNTIME"] === "edge") {
    await import("./sentry.edge.config");
  }
}
