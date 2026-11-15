import { describe, expect, it } from "vitest";

import { formFields } from "./form-fields";

describe("formFields", () => {
  it("reads string fields and maps missing fields and files to null", () => {
    const formData = new FormData();
    formData.set("issueId", "issue-1");
    formData.set("status", "");
    formData.set("photo", new File(["x"], "photo.png"));
    formData.set("ignored", "not requested");

    expect(
      formFields(formData, ["issueId", "status", "photo", "absent"])
    ).toEqual({
      issueId: "issue-1",
      status: "",
      photo: null,
      absent: null,
    });
  });
});
