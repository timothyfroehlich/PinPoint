/**
 * Server Observability Logger - Phase 2B
 * Structured logging utility integrated with request context
 * 
 * Provides simplified log(level, message, meta?) API while leveraging
 * existing pino-based infrastructure and tracing context.
 */

import { logger as baseLogger, type LoggerInterface } from "~/lib/logger";
import { getTraceContext } from "~/lib/tracing";
import { getRequestAuthContext } from "~/server/auth/context";

/**
 * Log level enumeration for type safety
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Meta object for additional log context
 */
export interface LogMeta {
  [key: string]: unknown;
  requestId?: string;
  traceId?: string;
  userId?: string;
  organizationId?: string;
}

/**
 * Structured log function with automatic request context enrichment
 * 
 * @param level - Log level (debug, info, warn, error)
 * @param message - Human-readable message
 * @param meta - Additional metadata (automatically enriched with request context)
 */
export async function log(level: LogLevel, message: string, meta: LogMeta = {}): Promise<void> {
  try {
    // Auto-enrich with request context when available
    const enrichedMeta = await enrichLogMeta(meta);
    
    // Create structured log object
    const logObject = {
      msg: message,
      ...enrichedMeta,
    };

    // Delegate to underlying logger
    baseLogger[level](logObject);
  } catch (error) {
    // Fallback logging - never let logging failure break application
    console.error("[OBSERVABILITY-LOGGER] Failed to log message:", error);
    console[level](`[${level.toUpperCase()}]`, message, meta);
  }
}

/**
 * Create a child logger with persistent context
 * Useful for scoping logs to specific operations or components
 */
export function createContextLogger(context: LogMeta): LoggerInterface & { log: typeof log } {
  const childLogger = baseLogger.child(context);
  
  return {
    ...childLogger,
    log: async (level: LogLevel, message: string, meta: LogMeta = {}) => {
      // Merge child context with provided meta
      const mergedMeta = { ...context, ...meta };
      await log(level, message, mergedMeta);
    },
  };
}

/**
 * Enrich log metadata with available request context
 * Safely handles cases where context is not available
 */
async function enrichLogMeta(meta: LogMeta): Promise<LogMeta> {
  const enriched: LogMeta = { ...meta };
  
  // Add tracing context if available
  try {
    const traceContext = getTraceContext();
    if (traceContext) {
      enriched.requestId ??= traceContext.requestId;
      enriched.traceId ??= traceContext.traceId;
    }
  } catch {
    // Trace context not available - continue without it
  }
  
  // Add auth context if available (and not already provided)
  if (!enriched.userId || !enriched.organizationId) {
    try {
      const authContext = await getRequestAuthContext();
      if (authContext.kind === 'authorized') {
        enriched.userId ??= authContext.user.id;
        enriched.organizationId ??= authContext.org.id;
      } else if (authContext.kind === 'no-membership') {
        enriched.userId ??= authContext.user.id;
        enriched.organizationId ??= authContext.orgId;
      }
    } catch {
      // Auth context not available - continue without it
    }
  }
  
  return enriched;
}

/**
 * Convenience functions for common log levels
 */
export const logDebug = (message: string, meta?: LogMeta) => log("debug", message, meta);
export const logInfo = (message: string, meta?: LogMeta) => log("info", message, meta);
export const logWarn = (message: string, meta?: LogMeta) => log("warn", message, meta);
export const logError = (message: string, meta?: LogMeta) => log("error", message, meta);