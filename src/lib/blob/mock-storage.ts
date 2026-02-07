export function shouldUseMockBlobStorage(): boolean {
  if (process.env["MOCK_BLOB_STORAGE"] === "true") {
    return true;
  }

  // Local/dev fallback: if no blob token is configured, use mock storage.
  // Production should fail loudly when blob credentials are missing.
  return (
    process.env.NODE_ENV !== "production" &&
    !process.env["BLOB_READ_WRITE_TOKEN"]
  );
}
