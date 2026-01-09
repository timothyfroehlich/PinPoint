import { NextResponse } from "next/server";
import { z } from "zod";
import { log } from "~/lib/logger";

export const dynamic = "force-dynamic";

export const clientLogEntrySchema = z.object({
  level: z.enum(["log", "info", "warn", "error", "debug"]),
  message: z
    .string()
    .min(1, "message is required")
    .max(5000, "Message too long"),
  args: z.array(z.unknown()).max(10, "Too many args").optional(),
  timestamp: z.number().int().nonnegative(),
  userAgent: z.string().max(500, "User agent too long").optional(),
  url: z.string().max(2000, "URL too long").optional(),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedEntry = clientLogEntrySchema.safeParse(body);
  if (!parsedEntry.success) {
    return NextResponse.json(
      { error: "Invalid log entry payload" },
      { status: 400 }
    );
  }

  const entry = parsedEntry.data;

  try {
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
