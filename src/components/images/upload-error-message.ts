function isBodySizeLimitError(message: string): boolean {
  return /body exceeded .*limit/i.test(message);
}

export function getUploadErrorMessage(error: unknown): string {
  if (error instanceof Error && isBodySizeLimitError(error.message)) {
    return "Upload size limit exceeded. Please try again with a smaller file.";
  }

  return "An unexpected error occurred during upload";
}
