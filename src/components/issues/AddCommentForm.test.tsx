import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddCommentForm } from "./AddCommentForm";
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
    vi.clearAllMocks();
    editorClearMocks.length = 0;
    // Default mock: [state, action, isPending]
    mockUseActionState.mockReturnValue([undefined, vi.fn(), false]);
  });

  it("renders correctly", () => {
    render(<AddCommentForm issueId="123" />);
    // "Add Comment" text is present when not pending
    expect(
      screen.getByRole("button", { name: "Add Comment" })
    ).toBeInTheDocument();
  });

  it("shows loading state when pending (using standard loading prop)", () => {
    mockUseActionState.mockReturnValue([undefined, vi.fn(), true]);
    render(<AddCommentForm issueId="123" />);

    const button = screen.getByRole("button", { name: "Add Comment" });
    expect(button).toBeDisabled();

    // Check that standard text is maintained (Button handles spinner internally)
    expect(screen.getByText("Add Comment")).toBeInTheDocument();

    // Ensure "Adding..." is NOT present
    expect(screen.queryByText("Adding...")).not.toBeInTheDocument();
  });

  it("calls toast on success", async () => {
    mockUseActionState.mockReturnValue([{ ok: true }, vi.fn(), false]);
    render(<AddCommentForm issueId="123" />);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Comment added");
    });
  });

  it("clears the rich text editor after a successful submit (PP-8mq)", async () => {
    // The form action returns ok:true, mirroring the post-submit re-render
    // produced by useActionState in production. The AddCommentForm useEffect
    // should call editorRef.current.clear() to wipe the editor body.
    mockUseActionState.mockReturnValue([{ ok: true }, vi.fn(), false]);
    render(<AddCommentForm issueId="123" />);

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

  it("resets uploaded images and hidden imagesMetadata input after a successful submit", async () => {
    mockUseActionState.mockReturnValue([undefined, vi.fn(), false]);
    const { rerender } = render(<AddCommentForm issueId="123" />);

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
    rerender(<AddCommentForm issueId="123" />);

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
