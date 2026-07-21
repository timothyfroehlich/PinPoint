import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  parseDraft,
  serializeDraft,
  defaultEntry,
  emptySingle,
  DRAFT_VERSION,
  type ReportDraft,
} from "./report-draft-schema";

const MACHINE = randomUUID();
const KEY = randomUUID();

const freshDraft = (): ReportDraft => ({
  version: DRAFT_VERSION,
  entries: [defaultEntry(KEY)],
  single: emptySingle(),
});

describe("report-draft-schema", () => {
  it("round-trips a fresh draft through serialize/parse", () => {
    const draft = freshDraft();
    draft.entries[0].machineId = MACHINE;
    draft.entries[0].title = "Right flipper sticky";
    const back = parseDraft(serializeDraft(draft));
    expect(back).not.toBeNull();
    expect(back?.entries[0]).toMatchObject({
      machineId: MACHINE,
      title: "Right flipper sticky",
      idempotencyKey: KEY,
    });
  });

  it("preserves a ProseMirror description doc", () => {
    const draft = freshDraft();
    draft.entries[0].description = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    };
    const back = parseDraft(serializeDraft(draft));
    expect(back?.entries[0]?.description).toEqual(draft.entries[0].description);
  });

  it("migrates a legacy report_form_state draft into entry #1 + single-only", () => {
    const legacy = JSON.stringify({
      machineId: MACHINE,
      title: "Stuck flipper",
      severity: "major",
      priority: "high",
      frequency: "frequent",
      watchIssue: false,
      firstName: "Ada",
      lastName: "L",
      email: "ada@example.com",
      idempotencyKey: KEY,
      uploadedImages: [],
    });
    const draft = parseDraft(legacy);
    expect(draft?.version).toBe(DRAFT_VERSION);
    expect(draft?.entries).toHaveLength(1);
    expect(draft?.entries[0]).toMatchObject({
      machineId: MACHINE,
      title: "Stuck flipper",
      severity: "major",
      priority: "high",
      frequency: "frequent",
      watch: false,
      status: "new",
      idempotencyKey: KEY,
    });
    expect(draft?.single).toMatchObject({
      firstName: "Ada",
      lastName: "L",
      email: "ada@example.com",
    });
  });

  it("mints an idempotency key when a legacy draft lacks one", () => {
    const legacy = JSON.stringify({ machineId: MACHINE, title: "x" });
    const draft = parseDraft(legacy);
    expect(draft?.entries[0]?.idempotencyKey).toMatch(
      /^[0-9a-f-]{36}$/i // any uuid
    );
  });

  it("keeps defaults for invalid legacy enum values", () => {
    const legacy = JSON.stringify({
      machineId: MACHINE,
      title: "x",
      severity: "not-a-severity",
      idempotencyKey: KEY,
    });
    const draft = parseDraft(legacy);
    expect(draft?.entries[0]?.severity).toBe("minor"); // default kept
  });

  it("drops legacy image rows missing required metadata (PP-2053.6)", () => {
    const legacy = JSON.stringify({
      machineId: MACHINE,
      title: "x",
      idempotencyKey: KEY,
      uploadedImages: [
        { blobUrl: "u", blobPathname: "p" }, // missing originalFilename etc.
        {
          blobUrl: "u2",
          blobPathname: "p2",
          originalFilename: "a.png",
          fileSizeBytes: 10,
          mimeType: "image/png",
        },
      ],
    });
    const draft = parseDraft(legacy);
    expect(draft?.single.uploadedImages).toHaveLength(1);
    expect(draft?.single.uploadedImages[0]?.originalFilename).toBe("a.png");
  });

  it("returns null (never throws) on corrupt JSON", () => {
    expect(parseDraft("{not json")).toBeNull();
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("")).toBeNull();
  });

  it("returns null on a structurally-invalid new-shape draft", () => {
    // version present but entries empty — fails schema, not legacy either.
    expect(parseDraft(JSON.stringify({ version: 2, entries: [] }))).toBeNull();
  });
});
