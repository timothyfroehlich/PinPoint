export const BLOB_CONFIG = {
  // File validation
  ALLOWED_MIME_TYPES: ["image/jpeg", "image/png", "image/webp"] as const,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB before compression
  MIN_FILE_SIZE_BYTES: 1024, // 1 KB
  MAX_DIMENSIONS: 8192, // Vercel Blob limit

  // Compression settings
  COMPRESSION: {
    FULL_IMAGE_MAX_MB: 2,
    FULL_IMAGE_QUALITY: 0.9,
    CROPPED_IMAGE_MAX_MB: 1,
    CROPPED_IMAGE_QUALITY: 0.95, // Higher quality for detail shots
  },

  // Upload limits
  LIMITS: {
    PUBLIC_USER_MAX: 2,
    AUTHENTICATED_USER_MAX: 4,
    ISSUE_TOTAL_MAX: 10,
  },

  // Rate limiting
  RATE_LIMIT: {
    PER_MINUTE: 2,
    PER_HOUR: 10,
  },

  // Cleanup
  // TODO: Implement cron/cleanup job to delete blobs in "pending" folder older than 24h
  // TODO: Implement cron/cleanup job to enforce SOFT_DELETE_RETENTION_HOURS
  SOFT_DELETE_RETENTION_HOURS: 24,
} as const;

export type AllowedMimeType = (typeof BLOB_CONFIG.ALLOWED_MIME_TYPES)[number];
