import { render, screen, waitFor } from "@testing-library/react";
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

// Mock the dynamic RichTextEditor so tests don't require a DOM/TipTap runtime
// (next/dynamic + TipTap use browser APIs unavailable in the jsdom environment).
// The mock implements the RichTextEditorHandle interface via forwardRef so the
// component can wire a ref without runtime errors.
// Uses an async factory to avoid the hoisting constraint that prevents top-level
// variable access inside synchronous vi.mock() factories.
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
      useImperativeHandle(ref, () => ({
        clear: vi.fn(),
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
});
