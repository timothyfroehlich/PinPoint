import { describe, expect, it } from "vitest";
import { getUploadErrorMessage } from "~/components/images/upload-error-message";

describe("getUploadErrorMessage", () => {
  it("returns a clear size-limit message for server action body limit errors", () => {
    const result = getUploadErrorMessage(
      new Error("Body exceeded 1 MB limit.")
    );

    expect(result).toBe(
      "Image exceeds the upload size limit. Please use an image under 10MB."
    );
  });

  it("returns generic message for unknown errors", () => {
    const result = getUploadErrorMessage(new Error("Some other failure"));

    expect(result).toBe("An unexpected error occurred during upload");
  });
});
