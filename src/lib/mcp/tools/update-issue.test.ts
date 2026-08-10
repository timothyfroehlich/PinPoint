/**
 * Unit test: update_issue per-field permission mapping (PP-u4ab.14)
 *
 * The matrix splits issue edits two ways — `issues.update.reporting` for the
 * fields a reporter naturally owns, `issues.update.triage` for the
 * organizational ones. A field mapped to the wrong permission is a silent
 * privilege change that no type check catches, and the map is small enough to
 * assert directly.
 */

import { describe, expect, it } from "vitest";

import { getPermission } from "~/lib/permissions/matrix";

import { UPDATE_FIELD_PERMISSIONS } from "./update-issue";

describe("UPDATE_FIELD_PERMISSIONS", () => {
  it("maps reporter-owned fields to issues.update.reporting", () => {
    expect(UPDATE_FIELD_PERMISSIONS.title).toBe("issues.update.reporting");
    expect(UPDATE_FIELD_PERMISSIONS.status).toBe("issues.update.reporting");
    expect(UPDATE_FIELD_PERMISSIONS.severity).toBe("issues.update.reporting");
    expect(UPDATE_FIELD_PERMISSIONS.frequency).toBe("issues.update.reporting");
  });

  it("maps organizational fields to issues.update.triage", () => {
    expect(UPDATE_FIELD_PERMISSIONS.priority).toBe("issues.update.triage");
    expect(UPDATE_FIELD_PERMISSIONS.assignee).toBe("issues.update.triage");
  });

  it("covers every updatable field and nothing else", () => {
    expect(Object.keys(UPDATE_FIELD_PERMISSIONS).sort()).toEqual([
      "assignee",
      "frequency",
      "priority",
      "severity",
      "status",
      "title",
    ]);
  });

  /**
   * A typo in a permission id fails CLOSED and silently: `getPermission`
   * returns `false` for an unknown id, so the tool would deny every call for
   * that field with no error naming the cause. Admin holds both real ids
   * unconditionally, so `true` here is what separates a live id from a typo.
   */
  it("names permission ids that exist in the matrix", () => {
    for (const permissionId of Object.values(UPDATE_FIELD_PERMISSIONS)) {
      expect(getPermission(permissionId, "admin")).toBe(true);
    }
  });
});
