/**
 * RTL tests for draft-persistence behavior in UnifiedReportForm (PP-2053.6).
 *
 * Tests verify:
 *  - name/email/image metadata survive a simulated reload (localStorage → state restore)
 *  - draft is preserved on a failed submission (state.success is falsy)
 *  - draft is cleared on a genuine success (state.success is truthy)
 *
 * Strategy: the form uses useActionState internally. We mock the React module so
 * we can inject controlled [state, action, isPending] tuples, exactly like the
 * existing update-issue-forms-rollback tests.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UnifiedReportForm } from "./unified-report-form";
import type { ActionState } from "./unified-report-form";
// Import the REAL schema (NOT mocked) so the round-trip test proves a restored
// draft's images survive submit-time validation. This is the regression guard
// for the silent-image-drop bug (PP-2053.6 review): restored images must carry
// originalFilename/fileSizeBytes/mimeType or imagesMetadataArraySchema.parse
// rejects them inside a swallowing try/catch and the photos vanish.
import { imagesMetadataArraySchema } from "../issues/schemas";

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./actions", () => ({
  submitPublicIssueAction: vi.fn(),
  getRecentIssuesAction: vi.fn().mockResolvedValue({ ok: true, value: [] }),
}));

// Stub out heavy child components to keep the test surface minimal.
vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: ({ ariaLabel }: { ariaLabel: string }) => (
    <div aria-label={ariaLabel} data-testid="rich-text-editor" />
  ),
}));

vi.mock("~/components/images/ImageUploadButton", () => ({
  ImageUploadButton: () => <div data-testid="image-upload-button" />,
}));

vi.mock("~/components/images/ImageGallery", () => ({
  ImageGallery: ({ images }: { images: { id: string }[] }) => (
    <div data-testid="image-gallery" data-image-count={images.length} />
  ),
}));

vi.mock("~/components/security/TurnstileWidget", () => ({
  TurnstileWidget: () => <div data-testid="turnstile" />,
}));

vi.mock("~/components/issues/RecentIssuesPanelClient", () => ({
  RecentIssuesPanelClient: () => <div data-testid="recent-issues" />,
}));

vi.mock("~/components/issues/fields/SeveritySelect", () => ({
  SeveritySelect: ({ value }: { value: string }) => (
    <div data-testid="severity-select" data-value={value} />
  ),
}));
vi.mock("~/components/issues/fields/FrequencySelect", () => ({
  FrequencySelect: ({ value }: { value: string }) => (
    <div data-testid="frequency-select" data-value={value} />
  ),
}));
vi.mock("~/components/issues/fields/PrioritySelect", () => ({
  PrioritySelect: ({ value }: { value: string }) => (
    <div data-testid="priority-select" data-value={value} />
  ),
}));
vi.mock("~/components/issues/fields/StatusSelect", () => ({
  StatusSelect: ({ value }: { value: string }) => (
    <div data-testid="status-select" data-value={value} />
  ),
}));

// ---------------------------------------------------------------------------
// useActionState mock — lets us inject controlled state between renders
// ---------------------------------------------------------------------------

const mockUseActionState = vi.fn();

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useActionState: (fn: unknown, initialState: unknown) =>
      mockUseActionState(fn, initialState),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MACHINES = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Addams Family",
    initials: "AF",
  },
];

const DEFAULT_PROPS = {
  machinesList: MACHINES,
  defaultMachineId: undefined,
  userAuthenticated: false,
  accessLevel: "unauthenticated" as const,
  assignees: [],
  initialIssues: [],
  initialMachineInitials: "",
};

function idleState(
  overrides: Partial<ActionState> = {}
): [ActionState, () => void, boolean] {
  return [overrides, vi.fn(), false];
}

// A fully-valid image-metadata row: a Vercel-blob hostname (always accepted by
// imageMetadataSchema's URL refinement) plus all three fields the schema
// requires. Mirrors what ImageUploadButton.onUploadComplete produces.
const VALID_IMAGE = {
  blobUrl:
    "https://abc123.public.blob.vercel-storage.com/uploads/photo-xyz.jpg",
  blobPathname: "uploads/photo-xyz.jpg",
  originalFilename: "photo.jpg",
  fileSizeBytes: 123456,
  mimeType: "image/jpeg",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UnifiedReportForm draft persistence (PP-2053.6)", () => {
  beforeEach(() => {
    localStorage.clear();
    // Default: idle, no success/error
    mockUseActionState.mockReturnValue(idleState());
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("name/email/image metadata survive a simulated reload", () => {
    it("restores firstName, lastName, and email from localStorage", () => {
      // Pre-seed localStorage as if the form was previously filled in
      localStorage.setItem(
        "report_form_state",
        JSON.stringify({
          machineId: MACHINES[0]?.id ?? "",
          title: "Left flipper dead",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
          uploadedImages: [],
        })
      );

      render(<UnifiedReportForm {...DEFAULT_PROPS} />);

      expect(screen.getByLabelText("First Name")).toHaveValue("Ada");
      expect(screen.getByLabelText("Last Name")).toHaveValue("Lovelace");
      expect(screen.getByLabelText("Email Address")).toHaveValue(
        "ada@example.com"
      );
    });

    it("restores full image metadata and renders the gallery stub", () => {
      localStorage.setItem(
        "report_form_state",
        JSON.stringify({ uploadedImages: [VALID_IMAGE] })
      );

      render(<UnifiedReportForm {...DEFAULT_PROPS} />);

      const gallery = screen.getByTestId("image-gallery");
      expect(gallery).toHaveAttribute("data-image-count", "1");
    });

    it("drops legacy slim-only image rows that lack required metadata", () => {
      // A draft written before the metadata fix carries only blobUrl/blobPathname.
      // Restoring it as-is would let the submit action silently reject the images
      // (schema requires originalFilename/fileSizeBytes/mimeType). The restore
      // effect filters such rows so the gallery never shows photos that won't
      // actually be saved.
      localStorage.setItem(
        "report_form_state",
        JSON.stringify({
          uploadedImages: [
            {
              blobUrl: VALID_IMAGE.blobUrl,
              blobPathname: VALID_IMAGE.blobPathname,
            },
          ],
        })
      );

      render(<UnifiedReportForm {...DEFAULT_PROPS} />);

      expect(screen.queryByTestId("image-gallery")).not.toBeInTheDocument();
    });

    it("does not restore uploadedImages when the array is empty", () => {
      localStorage.setItem(
        "report_form_state",
        JSON.stringify({ uploadedImages: [] })
      );

      render(<UnifiedReportForm {...DEFAULT_PROPS} />);

      // Gallery should not be rendered when there are no images
      expect(screen.queryByTestId("image-gallery")).not.toBeInTheDocument();
    });
  });

  describe("draft preserved on error, cleared on success", () => {
    it("preserves the draft in localStorage after a failed submission", async () => {
      const user = userEvent.setup();

      // Render with an idle state first so the form is interactive
      mockUseActionState.mockReturnValue(idleState({ error: undefined }));
      const { rerender } = render(<UnifiedReportForm {...DEFAULT_PROPS} />);

      // Type into the firstName field
      await user.type(screen.getByLabelText("First Name"), "Alan");

      // Simulate a failed action: state has an error but NOT success
      mockUseActionState.mockReturnValue(
        idleState({ error: "Server error: 504" })
      );
      rerender(<UnifiedReportForm {...DEFAULT_PROPS} />);

      // The draft should still be in localStorage (not cleared)
      const saved = localStorage.getItem("report_form_state");
      expect(saved).not.toBeNull();
    });

    it("clears localStorage on successful submission", async () => {
      const user = userEvent.setup();

      // Start idle
      mockUseActionState.mockReturnValue(idleState());
      const { rerender } = render(<UnifiedReportForm {...DEFAULT_PROPS} />);

      // Type some data so localStorage has content
      await user.type(screen.getByLabelText("First Name"), "Grace");

      // Confirm localStorage has the draft
      expect(localStorage.getItem("report_form_state")).not.toBeNull();

      // Simulate success
      mockUseActionState.mockReturnValue(idleState({ success: true }));

      rerender(<UnifiedReportForm {...DEFAULT_PROPS} />);

      expect(localStorage.getItem("report_form_state")).toBeNull();
    });

    it("clears firstName/lastName/email state on success", () => {
      // Pre-seed a draft with contact info
      localStorage.setItem(
        "report_form_state",
        JSON.stringify({
          firstName: "Grace",
          lastName: "Hopper",
          email: "grace@example.com",
        })
      );

      mockUseActionState.mockReturnValue(idleState());
      const { rerender } = render(<UnifiedReportForm {...DEFAULT_PROPS} />);

      // Fields are restored from localStorage
      expect(screen.getByLabelText("First Name")).toHaveValue("Grace");

      // Simulate success
      mockUseActionState.mockReturnValue(idleState({ success: true }));

      rerender(<UnifiedReportForm {...DEFAULT_PROPS} />);

      // Inputs should be cleared
      expect(screen.getByLabelText("First Name")).toHaveValue("");
      expect(screen.getByLabelText("Last Name")).toHaveValue("");
      expect(screen.getByLabelText("Email Address")).toHaveValue("");
    });
  });

  describe("restored image metadata survives submit-time validation (silent-drop guard)", () => {
    // Regression guard for PP-2053.6 review: persisting only blobUrl+blobPathname
    // made restored images fail imagesMetadataArraySchema.parse in actions.ts —
    // a throw swallowed by a non-blocking try/catch — so the issue was created
    // with ZERO images while the gallery still showed them. We run the value the
    // form actually serializes into the hidden imagesMetadata input through the
    // REAL schema (NOT the mocked ./actions) and assert it validates.
    function readSerializedImagesMetadata(): unknown {
      const hidden = document.querySelector<HTMLInputElement>(
        'input[name="imagesMetadata"]'
      );
      expect(hidden).not.toBeNull();
      return JSON.parse(hidden?.value ?? "[]") as unknown;
    }

    it("re-serializes restored images so imagesMetadataArraySchema accepts them", () => {
      // Seed a draft with full metadata, render, and read the hidden input the
      // submit action would receive.
      localStorage.setItem(
        "report_form_state",
        JSON.stringify({ uploadedImages: [VALID_IMAGE] })
      );

      mockUseActionState.mockReturnValue(idleState());
      render(<UnifiedReportForm {...DEFAULT_PROPS} />);

      const serialized = readSerializedImagesMetadata();

      // The exact parse actions.ts performs. It MUST succeed — otherwise the
      // image is silently dropped at submit time.
      const result = imagesMetadataArraySchema.safeParse(serialized);
      expect(result.success).toBe(true);
      expect(result.success && result.data).toHaveLength(1);
      expect(result.success && result.data[0]).toMatchObject({
        blobUrl: VALID_IMAGE.blobUrl,
        blobPathname: VALID_IMAGE.blobPathname,
        originalFilename: VALID_IMAGE.originalFilename,
        fileSizeBytes: VALID_IMAGE.fileSizeBytes,
        mimeType: VALID_IMAGE.mimeType,
      });
    });

    it("proves the OLD slim shape would have FAILED the schema (locks in the fix)", () => {
      // Directly assert that the previous behavior (placeholder metadata) does not
      // validate — so any regression back to slim persistence is caught here.
      const slimRestored = [
        {
          blobUrl: VALID_IMAGE.blobUrl,
          blobPathname: VALID_IMAGE.blobPathname,
          originalFilename: "",
          fileSizeBytes: 0,
          mimeType: "",
        },
      ];

      expect(imagesMetadataArraySchema.safeParse(slimRestored).success).toBe(
        false
      );
    });
  });
});
