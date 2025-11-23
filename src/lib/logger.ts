import pino from "pino";
import { mkdirSync } from "fs";
import { join } from "path";

const LOG_LEVEL = process.env["LOG_LEVEL"] ?? "info";
const DEFAULT_LOG_ROOT = join(process.cwd(), "logs");

/**
 * Creates a timestamped directory name in format: YYYY-MM-DD_HH-mm-ss
 * This ensures each server restart gets its own log directory
 */
function getTimestampedDir(): string {
  const now = new Date();
  const isoString = now.toISOString();
  const date = isoString.split("T")[0] ?? "unknown-date"; // YYYY-MM-DD
  const time =
    now.toTimeString().split(" ")[0]?.replace(/:/g, "-") ?? "unknown-time"; // HH-mm-ss
  return `${date}_${time}`;
}

/**
 * Attempt to create a session-specific log directory.
 * Falls back to undefined when the filesystem is read-only (e.g., Vercel serverless).
 */
function tryCreateSessionDirectory(): string | undefined {
  const baseDir = process.env["PINPOINT_LOG_DIR"] ?? DEFAULT_LOG_ROOT;
  try {
    mkdirSync(baseDir, { recursive: true });
    const sessionDir = join(baseDir, getTimestampedDir());
    mkdirSync(sessionDir, { recursive: true });
    return sessionDir;
  } catch (error) {
    // Silently fall back to stdout in serverless/read-only environments
    // or if we lack permissions. This is expected behavior in Vercel.
    const isReadOnly =
      error instanceof Error &&
      (error.message.includes("EROFS") || error.message.includes("ENOENT"));

    if (!isReadOnly) {
      console.warn(
        "[logger] Falling back to stdout-only logging (could not create log directory).",
        error instanceof Error ? error.message : error
      );
    }
    return undefined;
  }
}

/**
 * Create pino logger instance with:
 * - Timestamped directory per server restart (when filesystem is writable)
 * - Structured JSON logs
 * - Console output in development or when file logging is unavailable
 */
function createLogger(): pino.Logger {
  const sessionDir = tryCreateSessionDirectory();
  const logFile = sessionDir ? join(sessionDir, "app.log") : undefined;
  const isDevelopment = process.env.NODE_ENV === "development";

  const baseConfig: pino.LoggerOptions = {
    level: LOG_LEVEL,
    formatters: {
      level: (label: string) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  const streams: pino.StreamEntry[] = [];

  if (logFile) {
    streams.push({
      stream: pino.destination({
        dest: logFile,
        sync: false,
        mkdir: true,
      }),
    });
  }

  if (!logFile || isDevelopment) {
    streams.push({ stream: process.stdout });
  }

  if (streams.length === 0) {
    return pino(baseConfig);
  }

  if (streams.length === 1) {
    return pino(baseConfig, streams[0]!.stream);
  }

  return pino(baseConfig, pino.multistream(streams));
}

let loggerInstance: pino.Logger | null = null;

function getOrCreateLogger(): pino.Logger {
  loggerInstance ??= createLogger();
  return loggerInstance;
}

export function getLogger(): pino.Logger {
  return getOrCreateLogger();
}

export const log = {
  info: (obj: object | string, msg?: string) =>
    getOrCreateLogger().info(obj, msg),
  error: (obj: object | string, msg?: string) =>
    getOrCreateLogger().error(obj, msg),
  warn: (obj: object | string, msg?: string) =>
    getOrCreateLogger().warn(obj, msg),
  debug: (obj: object | string, msg?: string) =>
    getOrCreateLogger().debug(obj, msg),
};
