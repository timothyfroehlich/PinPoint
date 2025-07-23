/**
 * Test script to verify logger functionality
 * Run with: NODE_ENV=development npx tsx src/lib/logger/test.ts
 */

import { logger } from "./index";

function testLogger(): void {
  console.log("Testing Winston logger...");

  // Test different log levels
  logger.debug("Debug message - should appear in debug.log and console");

  logger.info(
    "Info message - should appear in combined.log, app.log, and console",
  );

  logger.warn(
    "Warning message - should appear in combined.log, app.log, and console",
  );

  logger.error(
    "Error message - should appear in error.log, combined.log, app.log, and console",
  );

  // Test with metadata
  logger.info("User login", {
    userId: "user-123",
    email: "test@example.com",
    organizationId: "org-456",
    timestamp: new Date().toISOString(),
  });

  logger.error("Database connection failed", {
    error: "Connection timeout",
    stack: "Error: Connection timeout\n    at Database.connect",
    code: "CONN_TIMEOUT",
    userId: "user-123",
  });

  // Test convenience methods
  logger.request("GET /api/users", {
    method: "GET",
    url: "/api/users",
    userAgent: "Mozilla/5.0...",
    ip: "127.0.0.1",
  });

  logger.response("Response sent", {
    statusCode: 200,
    duration: 125,
  });

  logger.database("User query executed", {
    query: "SELECT * FROM users WHERE id = $1",
    duration: 45,
    table: "users",
    operation: "read" as const,
  });

  logger.auth("User authenticated", {
    userId: "user-123",
    email: "test@example.com",
    action: "login" as const,
    provider: "credentials",
  });

  logger.upload("File uploaded", {
    fileName: "test.jpg",
    fileSize: 1024000,
    mimeType: "image/jpeg",
    uploadPath: "/uploads/issues/test.jpg",
    userId: "user-123",
  });

  logger.performance("API request completed", {
    method: "POST",
    url: "/api/trpc/user.create",
    duration: 234,
    statusCode: 201,
  });

  console.log(
    "Logger test completed. Check the logs/ directory for output files.",
  );
  console.log("Expected files: error.log, combined.log, debug.log, app.log");
}

// Export the function
export { testLogger };

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  testLogger();
}
