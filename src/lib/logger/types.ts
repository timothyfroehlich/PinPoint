/**
 * Logger types and interfaces for Winston-based logging
 */

export type LogMetadata = Record<string, unknown>;

export interface RequestLogMetadata extends LogMetadata {
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
  ip?: string;
}

export interface ErrorLogMetadata extends LogMetadata {
  error?: string;
  stack?: string;
  code?: string | number;
  userId?: string;
  organizationId?: string;
  procedure?: string;
}

export interface DatabaseLogMetadata extends LogMetadata {
  query?: string;
  duration?: number;
  table?: string;
  operation?: "create" | "read" | "update" | "delete";
}

export interface AuthLogMetadata extends LogMetadata {
  userId?: string;
  email?: string;
  organizationId?: string;
  action?: "login" | "logout" | "register" | "reset-password" | "verify-email";
  provider?: string;
}

export interface UploadLogMetadata extends LogMetadata {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadPath?: string;
  userId?: string;
  organizationId?: string;
}

export type LogLevel = "error" | "warn" | "info" | "debug";

export interface Logger {
  error(message: string, metadata?: ErrorLogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  debug(message: string, metadata?: LogMetadata): void;
}
