import { NextResponse } from "next/server";
import { log } from "~/lib/logger";

export const dynamic = "force-dynamic";

interface ClientLogEntry {
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;
  args?: unknown[];
  timestamp: number;
  userAgent?: string;
  url?: string;
}

/**
 * API endpoint that receives frontend console logs and writes them to the server log.
 * Only enabled in development mode.
 */
export async function POST(request: Request): Promise<Response> {
  // Only allow in development mode
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Client logging only available in development" },
      { status: 403 }
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = await request.json();

    // Validate required fields at runtime
    const validLevels = ["log", "info", "warn", "error", "debug"];
    if (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      !body.level ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      !validLevels.includes(body.level) ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      !body.message
    ) {
      return NextResponse.json(
        { error: "Missing required fields: level, message" },
        { status: 400 }
      );
    }

    // Now we can safely cast to the expected type
    const entry = body as ClientLogEntry;

    // Build log message with context
    const logData = {
      source: "client",
      level: entry.level,
      url: entry.url,
      userAgent: entry.userAgent,
      args: entry.args,
      clientTimestamp: entry.timestamp,
    };

    // Log to server using appropriate level
    switch (entry.level) {
      case "error":
        log.error(logData, `[CLIENT] ${entry.message}`);
        break;
      case "warn":
        log.warn(logData, `[CLIENT] ${entry.message}`);
        break;
      case "debug":
        log.debug(logData, `[CLIENT] ${entry.message}`);
        break;
      case "info":
      case "log":
      default:
        log.info(logData, `[CLIENT] ${entry.message}`);
        break;
    }

    return NextResponse.json({ ok: true });
  } catch {
    // Don't log errors to prevent potential infinite loops
    return NextResponse.json(
      { error: "Failed to process log entry" },
      { status: 500 }
    );
  }
}
