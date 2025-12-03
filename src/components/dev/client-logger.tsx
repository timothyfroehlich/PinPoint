"use client";

import { useEffect } from "react";

/**
 * Client-side logging shim that forwards console messages to the backend in development.
 * Intercepts console.log, console.info, console.warn, console.error, and console.debug.
 *
 * Features:
 * - Only active in development mode
 * - Prevents infinite loops by not sending its own errors to backend
 * - Preserves original console functionality
 * - Sends logs asynchronously to /api/client-logs
 */
export function ClientLogger(): null {
  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    // Store original console methods
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalDebug = console.debug;

    // Flag to prevent infinite loops
    let isSendingLog = false;

    /**
     * Helper to serialize an argument for JSON transmission
     */
    function serializeArg(arg: unknown): unknown {
      if (
        typeof arg === "string" ||
        typeof arg === "number" ||
        typeof arg === "boolean"
      ) {
        return arg;
      }
      if (arg === null || arg === undefined) {
        return arg;
      }
      if (arg instanceof Error) {
        return {
          name: arg.name,
          message: arg.message,
          stack: arg.stack,
        };
      }
      try {
        // Test if it can be serialized
        JSON.stringify(arg);
        return arg;
      } catch {
        // Handle circular references and unserializable objects
        return "[Unserializable]";
      }
    }

    /**
     * Send a log entry to the backend
     */
    function sendLogToBackend(
      level: "log" | "info" | "warn" | "error" | "debug",
      args: unknown[]
    ): void {
      // Prevent infinite loops
      if (isSendingLog) {
        return;
      }

      try {
        isSendingLog = true;

        // Convert arguments to a message string
        const message = args
          .map((arg) => {
            if (typeof arg === "string") {
              return arg;
            }
            if (arg instanceof Error) {
              return `${arg.name}: ${arg.message}\n${arg.stack ?? ""}`;
            }
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          })
          .join(" ");

        // Send to backend asynchronously (fire and forget)
        void fetch("/api/client-logs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            level,
            message,
            args: args.map(serializeArg),
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href,
          }),
        }).catch(() => {
          // Silently ignore fetch errors to prevent infinite loops
          // The original console method will still log to browser console
        });
      } finally {
        isSendingLog = false;
      }
    }

    /**
     * Create a wrapper function for console methods
     */
    function createConsoleWrapper(
      level: "log" | "info" | "warn" | "error" | "debug",
      originalMethod: (...args: unknown[]) => void
    ): (...args: unknown[]) => void {
      return function (...args: unknown[]): void {
        // Always call original method first
        originalMethod.apply(console, args);

        // Send to backend
        sendLogToBackend(level, args);
      };
    }

    // Wrap console methods
    console.log = createConsoleWrapper("log", originalLog);
    console.info = createConsoleWrapper("info", originalInfo);
    console.warn = createConsoleWrapper("warn", originalWarn);
    console.error = createConsoleWrapper("error", originalError);
    console.debug = createConsoleWrapper("debug", originalDebug);

    // Restore original methods on cleanup
    return () => {
      console.log = originalLog;
      console.info = originalInfo;
      console.warn = originalWarn;
      console.error = originalError;
      console.debug = originalDebug;
    };
  }, []);

  // This component doesn't render anything
  return null;
}
