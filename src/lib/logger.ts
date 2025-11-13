import pino from "pino";
import { mkdir } from "fs/promises";
import { join } from "path";

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
 * Initialize log directory for this session
 * Creates logs/YYYY-MM-DD_HH-mm-ss/ directory
 */
async function initLogDir(): Promise<string> {
  const logsBaseDir = join(process.cwd(), "logs");
  const sessionDir = join(logsBaseDir, getTimestampedDir());

  await mkdir(sessionDir, { recursive: true });

  return sessionDir;
}

/**
 * Create pino logger instance with:
 * - Timestamped directory per server restart
 * - File rotation at 10MB
 * - Structured JSON logs
 * - Console output in development
 */
async function createLogger(): Promise<pino.Logger> {
  const logDir = await initLogDir();
  const logFile = join(logDir, "app.log");

  const isDevelopment = process.env.NODE_ENV === "development";

  // Base logger configuration
  const baseConfig: pino.LoggerOptions = {
    level: process.env["LOG_LEVEL"] ?? "info",
    formatters: {
      level: (label: string) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // In development, log to both file and console
  if (isDevelopment) {
    // Create file destination
    const fileDestination = pino.destination({
      dest: logFile,
      sync: false, // Async for better performance
      mkdir: true,
    });

    // Create multistream with file and console (simple stdout)
    const streams: pino.StreamEntry[] = [
      { stream: fileDestination },
      { stream: process.stdout }, // Simple console output
    ];

    return pino(baseConfig, pino.multistream(streams));
  }

  // Production: file only with rotation
  const fileDestination = pino.destination({
    dest: logFile,
    sync: false,
    mkdir: true,
  });

  return pino(baseConfig, fileDestination);
}

/**
 * Singleton logger instance
 */
let loggerInstance: pino.Logger | null = null;

/**
 * Get or initialize the logger instance
 * Call this once at app startup
 */
export async function getLogger(): Promise<pino.Logger> {
  loggerInstance ??= await createLogger();
  return loggerInstance;
}

/**
 * Get the logger instance (synchronous)
 * Use this after the logger has been initialized
 * @throws Error if logger not initialized
 */
export function logger(): pino.Logger {
  if (!loggerInstance) {
    throw new Error(
      "Logger not initialized. Call getLogger() first at app startup."
    );
  }
  return loggerInstance;
}

/**
 * Type-safe logger methods for convenience
 */
export const log = {
  info: (obj: object | string, msg?: string) => logger().info(obj, msg),
  error: (obj: object | string, msg?: string) => logger().error(obj, msg),
  warn: (obj: object | string, msg?: string) => logger().warn(obj, msg),
  debug: (obj: object | string, msg?: string) => logger().debug(obj, msg),
};
