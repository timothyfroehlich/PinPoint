import pino from "pino";

import { env } from "~/env.js";
import { ERROR_MESSAGE_TRUNCATE_LENGTH } from "~/lib/logger-constants";

const isDev = env.NODE_ENV === "development";
const today = new Date().toISOString().split("T")[0] ?? "";

// Type guard for error objects
function isErrorObject(
  obj: unknown,
): obj is { error: Record<string, unknown> } {
  return typeof obj === "object" && obj !== null && "error" in obj;
}

function hasCodeAndMessage(
  error: Record<string, unknown>,
): error is { code: unknown; message: unknown } {
  return "code" in error && "message" in error;
}

// Define logger interface for type safety
interface LoggerInterface {
  info: (obj: object) => void;
  warn: (obj: object) => void;
  error: (obj: object) => void;
  debug: (obj: object) => void;
  child: (options: object) => LoggerInterface;
}

// Create safe logger configuration without problematic worker threads
function createLogger(): pino.Logger | LoggerInterface {
  try {
    // Base configuration for all environments
    const baseConfig = {
      level: env.LOG_LEVEL ?? (isDev ? "debug" : "info"),

      // Structured format for agent parsing
      formatters: {
        log: (object: Record<string, unknown>): Record<string, unknown> => {
          // Flatten error patterns for grep efficiency
          if (isErrorObject(object)) {
            const error = object.error;
            if (hasCodeAndMessage(error)) {
              const message =
                typeof error.message === "string"
                  ? error.message
                  : String(error.message);
              return {
                ...object,
                errorCode: error.code,
                errorMessage: message.substring(
                  0,
                  ERROR_MESSAGE_TRUNCATE_LENGTH,
                ),
              };
            }
          }
          return object;
        },
      },

      // Base fields
      base: {
        env: env.NODE_ENV,
        service: "pinpoint",
      },

      timestamp: pino.stdTimeFunctions.isoTime,

      // Security: redact sensitive data
      redact: {
        paths: ["password", "token", "secret", "authorization", "cookie"],
        censor: "[REDACTED]",
      },
    } satisfies pino.LoggerOptions;

    if (isDev) {
      // Development: Pretty console output only (file logging will be added via separate logger)
      return pino({
        ...baseConfig,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "SYS:standard",
            sync: false, // Better performance
          },
        },
      });
    } else {
      // Production: Simple file logging
      return pino({
        ...baseConfig,
        transport: {
          target: "pino/file",
          options: {
            destination: `logs/app-${today}.jsonl`,
            mkdir: true,
            sync: false, // Better performance
          },
        },
      });
    }
  } catch (error) {
    // Fallback to console logging if transports fail
    console.warn(
      "Failed to initialize pino logger, falling back to console:",
      error,
    );
    return createFallbackLogger();
  }
}

// Simple factory function for fallback logger
function createFallbackLogger(): LoggerInterface {
  return {
    info: (obj: object) => {
      console.log("INFO:", obj);
    },
    warn: (obj: object) => {
      console.warn("WARN:", obj);
    },
    error: (obj: object) => {
      console.error("ERROR:", obj);
    },
    debug: (obj: object) => {
      console.debug("DEBUG:", obj);
    },
    child: function (_options: object): LoggerInterface {
      return createFallbackLogger();
    },
  };
}

// Simple helper for dual child logger creation
function createDualChildLogger(
  mainChild: LoggerInterface,
  fileChild?: LoggerInterface,
): LoggerInterface {
  return {
    info: (obj: object) => {
      mainChild.info(obj);
      if (fileChild) fileChild.info(obj);
    },
    warn: (obj: object) => {
      mainChild.warn(obj);
      if (fileChild) fileChild.warn(obj);
    },
    error: (obj: object) => {
      mainChild.error(obj);
      if (fileChild) fileChild.error(obj);
    },
    debug: (obj: object) => {
      mainChild.debug(obj);
      if (fileChild) fileChild.debug(obj);
    },
    child: (options: object): LoggerInterface =>
      createDualChildLogger(
        mainChild.child(options),
        fileChild?.child(options),
      ),
  };
}

// Create the main logger (console in dev, file in prod)
const mainLogger = createLogger();

// Create a separate file logger for agent access in development
let fileLogger: pino.Logger | null = null;

if (isDev) {
  try {
    fileLogger = pino({
      level: env.LOG_LEVEL ?? "debug",
      formatters: {
        log: (object: Record<string, unknown>): Record<string, unknown> => {
          // Same formatting for agent parsing
          if (isErrorObject(object)) {
            const error = object.error;
            if (hasCodeAndMessage(error)) {
              const message =
                typeof error.message === "string"
                  ? error.message
                  : String(error.message);
              return {
                ...object,
                errorCode: error.code,
                errorMessage: message.substring(
                  0,
                  ERROR_MESSAGE_TRUNCATE_LENGTH,
                ),
              };
            }
          }
          return object;
        },
      },
      base: {
        env: env.NODE_ENV,
        service: "pinpoint",
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: ["password", "token", "secret", "authorization", "cookie"],
        censor: "[REDACTED]",
      },
      transport: {
        target: "pino/file",
        options: {
          destination: `logs/app-${today}.jsonl`,
          mkdir: true,
          sync: false,
        },
      },
    });
  } catch (error) {
    console.warn("Failed to create file logger for agents:", error);
    fileLogger = null;
  }
}

// Enhanced logger that logs to both console and file in development
export const logger = {
  info: (obj: object) => {
    mainLogger.info(obj);
    if (fileLogger) fileLogger.info(obj);
  },
  warn: (obj: object) => {
    mainLogger.warn(obj);
    if (fileLogger) fileLogger.warn(obj);
  },
  error: (obj: object) => {
    mainLogger.error(obj);
    if (fileLogger) fileLogger.error(obj);
  },
  debug: (obj: object) => {
    mainLogger.debug(obj);
    if (fileLogger) fileLogger.debug(obj);
  },
  child: (options: object) => {
    const mainChild = mainLogger.child(options);
    const fileChild = fileLogger?.child(options);
    return {
      info: (obj: object) => {
        mainChild.info(obj);
        if (fileChild) fileChild.info(obj);
      },
      warn: (obj: object) => {
        mainChild.warn(obj);
        if (fileChild) fileChild.warn(obj);
      },
      error: (obj: object) => {
        mainChild.error(obj);
        if (fileChild) fileChild.error(obj);
      },
      debug: (obj: object) => {
        mainChild.debug(obj);
        if (fileChild) fileChild.debug(obj);
      },
      child: (childOptions: object): LoggerInterface => {
        const mainChildLogger = mainChild.child(
          childOptions,
        ) as LoggerInterface;
        const fileChildLogger = fileChild?.child(childOptions) as
          | LoggerInterface
          | undefined;
        return createDualChildLogger(mainChildLogger, fileChildLogger);
      },
    };
  },
};
