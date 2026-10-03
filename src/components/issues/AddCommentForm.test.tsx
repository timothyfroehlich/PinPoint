import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddCommentForm } from "./AddCommentForm";
import { commentDraftKey } from "./comment-draft";
import React from "react";
import { toast } from "sonner";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock("~/app/(app)/issues/actions", () => ({
  addCommentAction: vi.fn(),
}));

vi.mock("~/components/images/ImageUploadButton", () => ({
  ImageUploadButton: ({
    onUploadComplete,
  }: {
    onUploadComplete?: (imageData: unknown) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-upload-image"
      onClick={() =>
        onUploadComplete?.({
          blobUrl:
            "https://abc123.public.blob.vercel-storage.com/uploads/test.jpg",
          blobPathname: "uploads/test.jpg",
          originalFilename: "test.jpg",
          fileSizeBytes: 1234,
          mimeType: "image/jpeg",
        })
      }
    >
      Upload Photo
    </button>
  ),
}));

vi.mock("~/components/images/ImageGallery", () => ({
  ImageGallery: () => <div data-testid="image-gallery" />,
}));

// Mock the dynamic RichTextEditor so tests don't require a DOM/TipTap runtime
// (next/dynamic + TipTap use browser APIs unavailable in the jsdom environment).
// The mock implements the RichTextEditorHandle interface via forwardRef so the
// component can wire a ref without runtime errors.
// Uses an async factory to avoid the hoisting constraint that prevents top-level
// variable access inside synchronous vi.mock() factories.
//
// To assert that the editor's clear() handle is invoked after a successful
// submit (PP-8mq), we record ALL clear mocks ever created in this test run.
// AddCommentForm calls setComment(null) inside the post-submit useEffect, which
// triggers a re-render that creates a new mock instance — so "latest" alone
// would point at a stale mock that was never invoked. Tests check the array.
const editorClearMocks: ReturnType<typeof vi.fn>[] = [];

vi.mock("~/components/editor/RichTextEditorDynamic", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  interface Handle {
    clear: () => void;
    focus: () => void;
    setContent: () => void;
  }
  return {
    RichTextEditor: forwardRef<Handle>(function MockRichTextEditor(
      _props: unknown,
      ref
    ) {
      const clearMock = vi.fn();
      editorClearMocks.push(clearMock);
      useImperativeHandle(ref, () => ({
        clear: clearMock,
        focus: vi.fn(),
        setContent: vi.fn(),
      }));
      return null;
    }),
  };
});

// Mock useActionState
const mockUseActionState = vi.fn();

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useActionState: (fn: unknown, initialState: unknown) =>
      mockUseActionState(fn, initialState),
  };
});

describe("AddCommentForm", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    editorClearMocks.length = 0;
    // Default mock: [state, action, isPending]
    mockUseActionState.mockReturnValue([undefined, vi.fn(), false]);
  });

  it("renders correctly", () => {
    render(<AddCommentForm issueId="123" userId="user-1" />);
    // "Add Comment" text is present when not pending
    expect(
      screen.getByRole("button", { name: "Add Comment" })
    ).toBeInTheDocument();
  });

  it("names the quick composer's formatting toggle by its visible text (WCAG 2.5.3)", () => {
    render(<AddCommentForm issueId="123" userId="user-1" quick />);
    expect(
      screen.getByRole("button", { name: "Aa formatting" })
    ).toBeInTheDocument();
  });

  it("announces a failed post as an alert", () => {
    mockUseActionState.mockReturnValue([
      { ok: false, code: "SERVER", message: "Failed to add comment" },
      vi.fn(),
      false,
    ]);
    render(<AddCommentForm issueId="123" userId="user-1" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to add comment"
    );
  });

  it("shows loading state when pending (using standard loading prop)", () => {
    mockUseActionState.mockReturnValue([undefined, vi.fn(), true]);
    render(<AddCommentForm issueId="123" userId="user-1" />);

    const button = screen.getByRole("button", { name: "Add Comment" });
    expect(button).toBeDisabled();

    // Check that standard text is maintained (Button handles spinner internally)
    expect(screen.getByText("Add Comment")).toBeInTheDocument();

    // Ensure "Adding..." is NOT present
    expect(screen.queryByText("Adding...")).not.toBeInTheDocument();
  });

  it("calls toast on success", async () => {
    mockUseActionState.mockReturnValue([
      { ok: true, value: { issueId: "123", commentId: "c-1" } },
      vi.fn(),
      false,
    ]);
    render(<AddCommentForm issueId="123" userId="user-1" />);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Comment added");
    });
  });

  it("acts on one post once, even when the parent passes a new callback", async () => {
    // The same result object across renders, as useActionState returns it.
    const posted = { ok: true, value: { issueId: "123", commentId: "c-1" } };
    mockUseActionState.mockReturnValue([posted, vi.fn(), false]);
    const first = vi.fn();
    const { rerender } = render(
      <AddCommentForm issueId="123" userId="user-1" onSubmitSuccess={first} />
    );
    await waitFor(() => {
      expect(first).toHaveBeenCalledWith("c-1");
    });

    // The mobile sheet re-renders its parent as it closes; an inline
    // callback is a new function each time.
    const second = vi.fn();
    rerender(
      <AddCommentForm issueId="123" userId="user-1" onSubmitSuccess={second} />
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    // One reset: the idempotency key changed once, not again.
    expect(
      editorClearMocks.filter((m) => m.mock.calls.length > 0)
    ).toHaveLength(1);
  });

  it("clears the rich text editor after a successful submit (PP-8mq)", async () => {
    // The form action returns ok:true, mirroring the post-submit re-render
    // produced by useActionState in production. The AddCommentForm useEffect
    // should call editorRef.current.clear() to wipe the editor body.
    mockUseActionState.mockReturnValue([
      { ok: true, value: { issueId: "123", commentId: "c-1" } },
      vi.fn(),
      false,
    ]);
    render(<AddCommentForm issueId="123" userId="user-1" />);

    // The toast firing in the same useEffect proves the effect ran; once that
    // happens, the imperative editor.clear() handle must also have fired.
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Comment added");
    });
    // At least one of the editor mocks (the one whose ref was bound at the
    // moment the effect ran) must have received the clear() call. We check
    // across all recorded mocks because setComment(null) triggers a re-render
    // that creates a fresh mock instance after the call happens.
    const anyCleared = editorClearMocks.some(
      (mock) => mock.mock.calls.length > 0
    );
    expect(anyCleared).toBe(true);

    // The hidden "comment" input is bound to controlled state (setComment(null)
    // is also called in the same effect). After reset, the serialized comment
    // value should be the empty string.
    const hiddenComment = document.querySelector<HTMLInputElement>(
      'input[name="comment"]'
    );
    expect(hiddenComment).not.toBeNull();
    expect(hiddenComment?.value).toBe("");
  });
  it("restores a saved draft into the submission — comment, photos with their imageIds, idempotency key", () => {
    const savedDoc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    };
    const photo = {
      blobUrl: "http://localhost:3000/blob/a.jpg",
      blobPathname: "issues/a.jpg",
      originalFilename: "a.jpg",
      fileSizeBytes: 2048,
      mimeType: "image/jpeg",
      imageId: "8a3c3e0e-5d1f-4a43-9e4f-3f6b1f0d2a11",
    };
    const key = "5b0f7a52-6c1e-4d0e-9c1b-2f8f6c3d4e5a";
    localStorage.setItem(
      commentDraftKey("user-1", "draft-issue"),
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        doc: savedDoc,
        images: [photo],
        idempotencyKey: key,
      })
    );

    render(<AddCommentForm issueId="draft-issue" userId="user-1" quick />);

    const field = (name: string): string | undefined =>
      document.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value;
    expect(JSON.parse(field("comment") ?? "")).toEqual(savedDoc);
    expect(JSON.parse(field("imagesMetadata") ?? "")).toEqual([photo]);
    expect(field("idempotencyKey")).toBe(key);
    // The photo shows in the composer, as it did before the sheet closed.
    expect(screen.getByTestId("image-gallery")).toBeInTheDocument();
  });

  it("clears the saved draft once the comment posts", async () => {
    const draftKey = commentDraftKey("user-1", "posted-issue");
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        doc: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Bye" }] },
          ],
        },
        images: [],
        idempotencyKey: "5b0f7a52-6c1e-4d0e-9c1b-2f8f6c3d4e5a",
      })
    );
    mockUseActionState.mockReturnValue([
      { ok: true, value: { issueId: "posted-issue", commentId: "c-9" } },
      vi.fn(),
      false,
    ]);

    render(<AddCommentForm issueId="posted-issue" userId="user-1" />);

    await waitFor(() => {
      expect(localStorage.getItem(draftKey)).toBeNull();
    });
    expect(
      document.querySelector<HTMLInputElement>('input[name="idempotencyKey"]')
        ?.value
    ).not.toBe("5b0f7a52-6c1e-4d0e-9c1b-2f8f6c3d4e5a");
  });

  it("resets uploaded images and hidden imagesMetadata input after a successful submit", async () => {
    mockUseActionState.mockReturnValue([undefined, vi.fn(), false]);
    const { rerender } = render(
      <AddCommentForm issueId="123" userId="user-1" />
    );

    const hiddenImages = document.querySelector<HTMLInputElement>(
      'input[name="imagesMetadata"]'
    );
    expect(hiddenImages).not.toBeNull();
    expect(hiddenImages?.value).toBe("[]");
    expect(screen.queryByTestId("image-gallery")).not.toBeInTheDocument();

    // Simulate uploading an image via ImageUploadButton
    fireEvent.click(screen.getByTestId("mock-upload-image"));

    // The hidden input should now serialize the uploaded image metadata
    const parsedImages = JSON.parse(hiddenImages?.value ?? "[]");
    expect(parsedImages).toHaveLength(1);
    expect(parsedImages[0]).toMatchObject({
      blobUrl: "https://abc123.public.blob.vercel-storage.com/uploads/test.jpg",
      originalFilename: "test.jpg",
    });
    expect(screen.getByTestId("image-gallery")).toBeInTheDocument();

    // Simulate successful form action completion (triggers post-submit useEffect)
    mockUseActionState.mockReturnValue([{ ok: true }, vi.fn(), false]);
    rerender(<AddCommentForm issueId="123" userId="user-1" />);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Comment added");
    });

    // setUploadedImages([]) in useEffect resets imagesMetadata input back to "[]"
    // and removes the ImageGallery
    await waitFor(() => {
      expect(hiddenImages?.value).toBe("[]");
      expect(screen.queryByTestId("image-gallery")).not.toBeInTheDocument();
    });
  });
});
