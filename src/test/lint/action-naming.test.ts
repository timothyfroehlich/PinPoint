import { describe, expect, it } from "vitest";

import { isConformingActionFilename } from "../../../eslint-rules/server-action-file-naming.mjs";

describe("isConformingActionFilename", () => {
  it.each([
    "actions.ts",
    "watcher-actions.ts",
    "export-action.ts",
    "test-discord-dm-action.ts",
    "src/server/actions/images.ts",
    "src\\server\\actions\\images.ts",
    "src/lib/pinballmap/actions.ts",
    "src/app/(app)/issues/actions.ts",
  ])("accepts conforming name: %s", (filename) => {
    expect(isConformingActionFilename(filename)).toBe(true);
  });

  it.each([
    "mutations.ts",
    "action.ts",
    "actions.tsx",
    "action.md",
    "actions.js",
    "reactions.ts",
    "src/server/actionable/thing.ts",
    "src/components/issues/issue-actions.tsx",
    "src/app/(app)/issues/action.ts",
  ])("rejects off-pattern name: %s", (filename) => {
    expect(isConformingActionFilename(filename)).toBe(false);
  });
});
