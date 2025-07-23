/**
 * Winston-based logging configuration for PinPoint
 * File-based logging for development, console logging for production
 */

import path from "path";
import { fileURLToPath } from "url";

import winston from "winston";

import type { Logger as LoggerInterface, LogMetadata } from "./types";

import { env } from "~/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root directory (3 levels up from src/lib/logger)
const projectRoot = path.resolve(__dirname, "../../..");
const logsDir = path.join(projectRoot, "logs");

const isDevelopment = env.NODE_ENV === "development";
const isTest = env.NODE_ENV === "test";

// Create formats
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    return `${String(timestamp)} [${String(level)}]: ${String(message)}${metaStr}`;
  }),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Create transports array
const transports: winston.transport[] = [];

// Add console transport for all environments
if (!isTest) {
  transports.push(
    new winston.transports.Console({
      level: isDevelopment ? "debug" : "info",
      format: consoleFormat,
    }),
  );
}

// Add file transports only for development
if (isDevelopment && !isTest) {
  transports.push(
    // Error logs - only error level
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
      tailable: true,
      zippedArchive: true,
    }),

    // Combined logs - info level and above
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      level: "info",
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),

    // Debug logs - all levels including debug
    new winston.transports.File({
      filename: path.join(logsDir, "debug.log"),
      level: "debug",
      format: fileFormat,
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 2,
      tailable: true,
    }),

    // Application-specific logs
    new winston.transports.File({
      filename: path.join(logsDir, "app.log"),
      level: "info",
      format: fileFormat,
      maxsize: 15 * 1024 * 1024, // 15MB
      maxFiles: 3,
      tailable: true,
    }),
  );
}

// Create the Winston logger
const winstonLogger = winston.createLogger({
  level: isDevelopment ? "debug" : "info",
  format: fileFormat,
  transports,
  // Handle exceptions and rejections
  exceptionHandlers:
    isDevelopment && !isTest
      ? [
          new winston.transports.File({
            filename: path.join(logsDir, "exceptions.log"),
            format: fileFormat,
            maxsize: 5 * 1024 * 1024,
            maxFiles: 2,
          }),
        ]
      : [],
  rejectionHandlers:
    isDevelopment && !isTest
      ? [
          new winston.transports.File({
            filename: path.join(logsDir, "rejections.log"),
            format: fileFormat,
            maxsize: 5 * 1024 * 1024,
            maxFiles: 2,
          }),
        ]
      : [],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Create a typed interface
class Logger implements LoggerInterface {
  error(message: string, metadata?: LogMetadata): void {
    winstonLogger.error(message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    winstonLogger.warn(message, metadata);
  }

  info(message: string, metadata?: LogMetadata): void {
    winstonLogger.info(message, metadata);
  }

  debug(message: string, metadata?: LogMetadata): void {
    winstonLogger.debug(message, metadata);
  }

  // Additional convenience methods
  request(message: string, metadata?: LogMetadata): void {
    this.info(`[REQUEST] ${message}`, metadata);
  }

  response(message: string, metadata?: LogMetadata): void {
    this.info(`[RESPONSE] ${message}`, metadata);
  }

  database(message: string, metadata?: LogMetadata): void {
    this.debug(`[DATABASE] ${message}`, metadata);
  }

  auth(message: string, metadata?: LogMetadata): void {
    this.info(`[AUTH] ${message}`, metadata);
  }

  upload(message: string, metadata?: LogMetadata): void {
    this.info(`[UPLOAD] ${message}`, metadata);
  }

  performance(message: string, metadata?: LogMetadata): void {
    this.debug(`[PERFORMANCE] ${message}`, metadata);
  }

  // Get the underlying Winston logger for advanced usage
  getWinstonLogger(): winston.Logger {
    return winstonLogger;
  }
}

// Create and export the singleton logger instance
export const logger = new Logger();

// Export the Winston logger for direct access if needed
export { winstonLogger };

// Export types
export type { LoggerInterface, LogMetadata };
export * from "./types";

// Log startup message
if (isDevelopment && !isTest) {
  logger.info("Logger initialized", {
    environment: env.NODE_ENV,
    logsDirectory: logsDir,
    transports: transports.map((t) => t.constructor.name),
  });
}
