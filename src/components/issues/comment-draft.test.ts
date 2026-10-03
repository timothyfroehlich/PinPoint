/**
 * Comment drafts (comment-draft.ts): saved as the author types or uploads,
 * restored on a fresh page, cleared after a post, and harmless without
 * browser storage. A "fresh page" is a fresh module instance
 * (`vi.resetModules`), which is what a reload gives the store.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import type { ImageMetadata } from "~/types/images";
import type * as DraftModuleNamespace from "./comment-draft";

type DraftModule = typeof DraftModuleNamespace;

async function freshPage(): Promise<DraftModule> {
  vi.resetModules();
  return import("./comment-draft");
}

function doc(text: string): ProseMirrorDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

const photo: ImageMetadata = {
  blobUrl: "http://localhost:3000/blob/photo.jpg",
  blobPathname: "issues/1/photo.jpg",
  originalFilename: "photo.jpg",
  fileSizeBytes: 2048,
  mimeType: "image/jpeg",
  imageId: "8a3c3e0e-5d1f-4a43-9e4f-3f6b1f0d2a11",
};

describe("comment drafts", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("saves typing after a pause and restores it, with its photos and idempotency key, on a fresh page", async () => {
    const page = await freshPage();
    const key = page.commentDraftKey("user-1", "issue-1");
    const { result } = renderHook(() => page.useCommentDraft(key, "sheet"));

    act(() => result.current.setDoc(doc("Flipper sticks")));
    // Not on every keystroke…
    expect(localStorage.getItem(key)).toBeNull();
    // …but once the author pauses.
    act(() => vi.advanceTimersByTime(page.COMMENT_DRAFT_SAVE_DELAY_MS));
    expect(localStorage.getItem(key)).not.toBeNull();

    // A photo is saved at once.
    act(() => result.current.addImage(photo));
    const savedKey = result.current.snapshot.draft.idempotencyKey;

    const reloaded = await freshPage();
    const { result: restored } = renderHook(() =>
      reloaded.useCommentDraft(key, "inline")
    );
    expect(restored.current.snapshot.draft).toEqual({
      doc: doc("Flipper sticks"),
      images: [photo],
      idempotencyKey: savedKey,
    });
  });

  it("keeps the idempotency key while the comment is unchanged and replaces it when the text or photos change", async () => {
    const page = await freshPage();
    const key = page.commentDraftKey("user-1", "issue-1");
    const { result } = renderHook(() => page.useCommentDraft(key, "sheet"));

    act(() => result.current.setDoc(doc("Flipper sticks")));
    const first = result.current.snapshot.draft.idempotencyKey;
    // The same comment again (a retry after a lost response) keeps the key…
    act(() => result.current.setDoc(doc("Flipper sticks")));
    expect(result.current.snapshot.draft.idempotencyKey).toBe(first);
    // …an edited comment is a new submission…
    act(() => result.current.setDoc(doc("Flipper sticks on multiball")));
    const edited = result.current.snapshot.draft.idempotencyKey;
    expect(edited).not.toBe(first);
    // …and so is one with another photo.
    act(() => result.current.addImage(photo));
    expect(result.current.snapshot.draft.idempotencyKey).not.toBe(edited);
  });

  it("sign-out removes every stored draft from the browser", async () => {
    const page = await freshPage();
    const mine = page.commentDraftKey("user-1", "issue-1");
    const other = page.commentDraftKey("user-1", "issue-2");
    const { result: a } = renderHook(() => page.useCommentDraft(mine, "s"));
    const { result: b } = renderHook(() => page.useCommentDraft(other, "s"));
    act(() => a.current.addImage(photo));
    act(() => b.current.addImage(photo));
    localStorage.setItem("unrelated", "keep");

    page.clearStoredCommentDrafts();

    expect(localStorage.getItem(mine)).toBeNull();
    expect(localStorage.getItem(other)).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });

  it("keeps drafts apart per person and per issue", async () => {
    const page = await freshPage();
    const mine = page.commentDraftKey("user-1", "issue-1");
    const { result } = renderHook(() => page.useCommentDraft(mine, "sheet"));
    act(() => result.current.addImage(photo));

    const reloaded = await freshPage();
    for (const other of [
      reloaded.commentDraftKey("user-2", "issue-1"),
      reloaded.commentDraftKey("user-1", "issue-2"),
    ]) {
      const { result: draft } = renderHook(() =>
        reloaded.useCommentDraft(other, "sheet")
      );
      expect(draft.current.snapshot.draft.images).toEqual([]);
    }
  });

  it("shares one draft between composers on the page, naming who changed it", async () => {
    const page = await freshPage();
    const key = page.commentDraftKey("user-1", "issue-1");
    const sheet = renderHook(() => page.useCommentDraft(key, "sheet"));
    const inline = renderHook(() => page.useCommentDraft(key, "inline"));

    act(() => sheet.result.current.setDoc(doc("Typed in the sheet")));

    expect(inline.result.current.snapshot).toEqual({
      draft: expect.objectContaining({ doc: doc("Typed in the sheet") }),
      origin: "sheet",
    });
  });

  it("survives the composer unmounting mid-pause (the sheet dismissed)", async () => {
    const page = await freshPage();
    const key = page.commentDraftKey("user-1", "issue-1");
    const sheet = renderHook(() => page.useCommentDraft(key, "sheet"));
    act(() => sheet.result.current.setDoc(doc("Half a thought")));
    sheet.unmount();

    const reopened = renderHook(() => page.useCommentDraft(key, "sheet-2"));
    expect(reopened.result.current.snapshot.draft.doc).toEqual(
      doc("Half a thought")
    );
    act(() => vi.advanceTimersByTime(page.COMMENT_DRAFT_SAVE_DELAY_MS));
    expect(localStorage.getItem(key)).toContain("Half a thought");
  });

  it("writes a pending save when the page is hidden or unloaded", async () => {
    const page = await freshPage();
    const key = page.commentDraftKey("user-1", "issue-1");
    const { result } = renderHook(() => page.useCommentDraft(key, "sheet"));
    act(() => result.current.setDoc(doc("Before reload")));

    window.dispatchEvent(new Event("pagehide"));

    expect(localStorage.getItem(key)).toContain("Before reload");
  });

  it("clears the stored draft after a post and starts a new submission", async () => {
    const page = await freshPage();
    const key = page.commentDraftKey("user-1", "issue-1");
    const { result } = renderHook(() => page.useCommentDraft(key, "sheet"));
    act(() => result.current.setDoc(doc("Posted")));
    act(() => result.current.addImage(photo));
    const postedKey = result.current.snapshot.draft.idempotencyKey;

    act(() => result.current.clear());

    expect(localStorage.getItem(key)).toBeNull();
    expect(result.current.snapshot.draft).toEqual({
      doc: null,
      images: [],
      idempotencyKey: expect.not.stringMatching(postedKey),
    });
    // The cleared draft stays cleared: no pending save resurrects it.
    act(() => vi.advanceTimersByTime(page.COMMENT_DRAFT_SAVE_DELAY_MS));
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("works for the page view without storage, and never throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const page = await freshPage();
    const key = page.commentDraftKey("user-1", "issue-1");

    const sheet = renderHook(() => page.useCommentDraft(key, "sheet"));
    act(() => sheet.result.current.setDoc(doc("Kept in memory")));
    act(() => sheet.result.current.addImage(photo));
    act(() => vi.advanceTimersByTime(page.COMMENT_DRAFT_SAVE_DELAY_MS));
    sheet.unmount();

    const reopened = renderHook(() => page.useCommentDraft(key, "sheet-2"));
    expect(reopened.result.current.snapshot.draft).toEqual(
      expect.objectContaining({ doc: doc("Kept in memory"), images: [photo] })
    );
    act(() => reopened.result.current.clear());
    expect(reopened.result.current.snapshot.draft.doc).toBeNull();
  });

  describe("parseCommentDraft", () => {
    const stored = (overrides: Record<string, unknown>): string =>
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        doc: doc("Saved"),
        images: [],
        idempotencyKey: "5b0f7a52-6c1e-4d0e-9c1b-2f8f6c3d4e5a",
        ...overrides,
      });

    it.each([
      ["absent", null],
      ["not JSON", "{oops"],
      ["another version", stored({ version: 2 })],
      ["a doc that is not a document", stored({ doc: { type: "para" } })],
      ["a key that is not a UUID", stored({ idempotencyKey: "abc" })],
      [
        "older than 30 days",
        stored({ savedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 }),
      ],
      ["empty", stored({ doc: null, images: [] })],
    ])("restores nothing from a draft that is %s", async (_label, raw) => {
      const { parseCommentDraft } = await freshPage();
      expect(parseCommentDraft(raw)).toBeNull();
    });

    it("drops malformed photos and keeps at most the comment limit", async () => {
      const { parseCommentDraft } = await freshPage();
      const draft = parseCommentDraft(
        stored({
          images: [
            photo,
            { ...photo, mimeType: "text/html" },
            { ...photo, imageId: 42 },
            "nope",
            photo,
            photo,
            photo,
          ],
        })
      );
      expect(draft?.images).toEqual([photo, photo, photo, photo]);
    });
  });
});
