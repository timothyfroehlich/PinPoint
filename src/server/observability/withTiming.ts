/**
 * Timing Wrapper - Phase 2B
 * Execution timing utility with structured logging
 * 
 * Provides withTiming(label, fn) wrapper that logs duration in milliseconds
 * for manual p95 performance tracking and monitoring.
 */

import { performance } from "perf_hooks";

import { log, logWarn, type LogMeta } from "./logger";

/**
 * Performance thresholds for alerting
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Operations taking longer than this are logged as warnings */
  SLOW_OPERATION_MS: 1000,
  /** Operations taking longer than this are logged as errors */
  VERY_SLOW_OPERATION_MS: 5000,
} as const;

/**
 * Timing result returned by withTiming
 */
export interface TimingResult<T> {
  /** The result of the executed function */
  result: T;
  /** Duration in milliseconds */
  durationMs: number;
  /** Performance level based on duration */
  performanceLevel: "fast" | "normal" | "slow" | "very-slow";
}

/**
 * Options for timing wrapper
 */
export interface TimingOptions {
  /** Additional metadata to include in logs */
  context?: LogMeta;
  /** Whether to log start/completion messages */
  logEvents?: boolean;
  /** Custom performance thresholds */
  thresholds?: {
    slowMs?: number;
    verySlowMs?: number;
  };
}

/**
 * Wraps a function with execution timing and structured logging
 * 
 * @param label - Human-readable label for the operation
 * @param fn - Function to execute and time
 * @param options - Additional timing options
 * @returns Promise resolving to TimingResult with result and duration
 */
export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>,
  options: TimingOptions = {}
): Promise<TimingResult<T>> {
  const {
    context = {},
    logEvents = true,
    thresholds = {},
  } = options;
  
  const slowThreshold = thresholds.slowMs ?? PERFORMANCE_THRESHOLDS.SLOW_OPERATION_MS;
  const verySlowThreshold = thresholds.verySlowMs ?? PERFORMANCE_THRESHOLDS.VERY_SLOW_OPERATION_MS;
  
  const startTime = performance.now();
  const operationContext: LogMeta = {
    ...context,
    operation: label,
    component: "withTiming",
  };

  if (logEvents) {
    await log("debug", `${label} started`, {
      ...operationContext,
      event: "operation_started",
    });
  }

  try {
    const result = await fn();
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);
    
    const performanceLevel = getPerformanceLevel(durationMs, slowThreshold, verySlowThreshold);
    
    const timingContext: LogMeta = {
      ...operationContext,
      durationMs,
      performanceLevel,
      event: "operation_completed",
    };

    // Log based on performance level
    if (performanceLevel === "very-slow") {
      await log("error", `${label} completed (VERY SLOW)`, {
        ...timingContext,
        alert: "very_slow_operation",
      });
    } else if (performanceLevel === "slow") {
      await logWarn(`${label} completed (SLOW)`, {
        ...timingContext,
        alert: "slow_operation",
      });
    } else if (logEvents) {
      await log("info", `${label} completed`, timingContext);
    }

    return {
      result,
      durationMs,
      performanceLevel,
    };
    
  } catch (error) {
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);
    
    await log("error", `${label} failed`, {
      ...operationContext,
      durationMs,
      event: "operation_failed",
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : "Unknown",
      },
    });
    
    // Re-throw the original error
    throw error;
  }
}

/**
 * Synchronous version of withTiming for non-async operations
 * 
 * @param label - Human-readable label for the operation
 * @param fn - Synchronous function to execute and time
 * @param options - Additional timing options
 * @returns TimingResult with result and duration
 */
export function withTimingSync<T>(
  label: string,
  fn: () => T,
  options: Omit<TimingOptions, 'logEvents'> & { logEvents?: false } = {}
): TimingResult<T> {
  const {
    context = {},
    thresholds = {},
  } = options;
  
  const slowThreshold = thresholds.slowMs ?? PERFORMANCE_THRESHOLDS.SLOW_OPERATION_MS;
  const verySlowThreshold = thresholds.verySlowMs ?? PERFORMANCE_THRESHOLDS.VERY_SLOW_OPERATION_MS;
  
  const startTime = performance.now();

  try {
    const result = fn();
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);
    
    const performanceLevel = getPerformanceLevel(durationMs, slowThreshold, verySlowThreshold);
    
    // Note: Sync version doesn't log automatically to avoid async issues
    // Use logTiming() separately if logging is needed
    
    return {
      result,
      durationMs,
      performanceLevel,
    };
    
  } catch (error) {
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);
    
    // Note: Error logging would be async, so we don't log here
    // Caller should handle error logging if needed
    
    throw error;
  }
}

/**
 * Manual timing log for when you want to log timing without wrapper
 * Useful for logging pre-calculated timings or sync operation results
 */
export async function logTiming(
  label: string,
  durationMs: number,
  context: LogMeta = {}
): Promise<void> {
  const performanceLevel = getPerformanceLevel(durationMs);
  
  const timingContext: LogMeta = {
    ...context,
    operation: label,
    component: "timing",
    durationMs,
    performanceLevel,
  };

  if (performanceLevel === "very-slow") {
    await log("error", `${label} timing: ${durationMs}ms (VERY SLOW)`, {
      ...timingContext,
      alert: "very_slow_operation",
    });
  } else if (performanceLevel === "slow") {
    await logWarn(`${label} timing: ${durationMs}ms (SLOW)`, {
      ...timingContext,
      alert: "slow_operation",
    });
  } else {
    await log("debug", `${label} timing: ${durationMs}ms`, timingContext);
  }
}

/**
 * Determine performance level based on duration
 */
function getPerformanceLevel(
  durationMs: number,
  slowThreshold = PERFORMANCE_THRESHOLDS.SLOW_OPERATION_MS,
  verySlowThreshold = PERFORMANCE_THRESHOLDS.VERY_SLOW_OPERATION_MS
): "fast" | "normal" | "slow" | "very-slow" {
  if (durationMs >= verySlowThreshold) {
    return "very-slow";
  } else if (durationMs >= slowThreshold) {
    return "slow";
  } else if (durationMs >= 100) {
    return "normal";
  } else {
    return "fast";
  }
}

/**
 * Higher-order function to create timing decorators
 * Useful for timing class methods or commonly used functions
 */
export function createTimingDecorator(label: string, options: TimingOptions = {}) {
  return function <T extends any[], R>(
    target: any,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const originalMethod = descriptor.value;
    
    if (!originalMethod) {
      throw new Error("Timing decorator can only be applied to methods");
    }
    
    descriptor.value = async function (...args: T): Promise<R> {
      const methodLabel = `${String(propertyKey)} (${label})`;
      const result = await withTiming(methodLabel, () => originalMethod.apply(this, args), options);
      return result.result;
    };
    
    return descriptor;
  };
}

/**
 * Performance statistics aggregator for manual p95 tracking
 * Collects timing data for later analysis
 */
export class PerformanceCollector {
  private timings: Map<string, number[]> = new Map();
  
  /**
   * Record a timing measurement
   */
  record(operation: string, durationMs: number): void {
    const existing = this.timings.get(operation) || [];
    existing.push(durationMs);
    this.timings.set(operation, existing);
  }
  
  /**
   * Get statistics for an operation
   */
  getStats(operation: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } | null {
    const timings = this.timings.get(operation);
    if (!timings || timings.length === 0) {
      return null;
    }
    
    const sorted = [...timings].sort((a, b) => a - b);
    const count = sorted.length;
    
    return {
      count,
      min: sorted[0]!,
      max: sorted[count - 1]!,
      avg: Math.round(sorted.reduce((a, b) => a + b, 0) / count),
      p50: sorted[Math.floor(count * 0.5)]!,
      p90: sorted[Math.floor(count * 0.9)]!,
      p95: sorted[Math.floor(count * 0.95)]!,
      p99: sorted[Math.floor(count * 0.99)]!,
    };
  }
  
  /**
   * Clear all timing data
   */
  clear(): void {
    this.timings.clear();
  }
  
  /**
   * Get all operation names being tracked
   */
  getOperations(): string[] {
    return Array.from(this.timings.keys());
  }
}

/**
 * Global performance collector instance
 */
export const globalPerformanceCollector = new PerformanceCollector();