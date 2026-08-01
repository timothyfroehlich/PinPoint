/**
 * RTL tests for UnifiedReportForm now that persistence lives in the shared
 * ReportDraftProvider (PP-idrb). The form is rendered inside the provider and
 * these tests verify the form ↔ store wiring end-to-end:
 *
 *  - reporter identity + image metadata seeded into the draft surface on the form
 *  - a slim/legacy image row that fails hardening never shows in the gallery
 *  - the draft is preserved on a failed submit, cleared on a genuine success
 *  - restored images survive submit-time validation (the PP-2053.6 silent-drop guard)
 *
 * Strategy: the form uses useActionState internally. We mock the React module so
 * we can inject controlled [state, action, isPending] tuples between renders.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UnifiedReportForm } from "./unified-report-form";
import type { ActionState } from "./unified-report-form";
import { ReportDraftProvider } from "./report-draft-store";
import {
  serializeDraft,
  defaultEntry,
  emptySingle,
  DRAFT_VERSION,
  REPORT_DRAFT_KEY,
  type ReportDraft,
  type SharedEntry,
  type SingleOnlyState,
} from "./report-draft-schema";
import type { MachineOption } from "~/components/machines/MachineCombobox";
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

const MACHINE_OPTIONS: MachineOption[] = MACHINES.map((m) => ({
  value: m.id,
  name: m.name,
  initials: m.initials,
}));

const DEFAULT_PROPS = {
  machinesList: MACHINES,
  defaultMachineId: undefined,
  userAuthenticated: false,
  accessLevel: "unauthenticated" as const,
  assignees: [],
  initialIssues: [],
  initialMachineInitials: "",
};

/** Render the form inside the shared provider (required — the form reads it). */
function wrapped(
  props: typeof DEFAULT_PROPS = DEFAULT_PROPS
): React.JSX.Element {
  return (
    <ReportDraftProvider machines={MACHINE_OPTIONS} assignees={[]}>
      <UnifiedReportForm {...props} />
    </ReportDraftProvider>
  );
}

/** Pre-seed the unified draft in localStorage so the provider hydrates it. */
function seedDraft(over: {
  entry?: Partial<SharedEntry>;
  single?: Partial<SingleOnlyState>;
}): void {
  const draft: ReportDraft = {
    version: DRAFT_VERSION,
    entries: [{ ...defaultEntry(randomUUID()), ...over.entry }],
    single: { ...emptySingle(), ...over.single },
  };
  localStorage.setItem(REPORT_DRAFT_KEY, serializeDraft(draft));
}

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

describe("UnifiedReportForm ↔ shared draft store (PP-idrb)", () => {
  beforeEach(() => {
    localStorage.clear();
    // Default: idle, no success/error
    mockUseActionState.mockReturnValue(idleState());
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("seeded draft surfaces on the form", () => {
    it("shows firstName, lastName, and email hydrated from the draft", () => {
      seedDraft({
        entry: { machineId: MACHINES[0]?.id ?? "", title: "Left flipper dead" },
        single: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        },
      });

      render(wrapped());

      expect(screen.getByLabelText("First Name")).toHaveValue("Ada");
      expect(screen.getByLabelText("Last Name")).toHaveValue("Lovelace");
      expect(screen.getByLabelText("Email Address")).toHaveValue(
        "ada@example.com"
      );
    });

    it("renders the gallery for a fully-valid restored image", () => {
      seedDraft({ single: { uploadedImages: [VALID_IMAGE] } });

      render(wrapped());

      const gallery = screen.getByTestId("image-gallery");
      expect(gallery).toHaveAttribute("data-image-count", "1");
    });

    it("drops slim-only image rows that lack required metadata", () => {
      // A draft written before the metadata fix carries only blobUrl/blobPathname.
      // The provider's hardening filters such rows so the gallery never shows
      // photos the submit action would silently reject.
      seedDraft({
        single: {
          uploadedImages: [
            {
              blobUrl: VALID_IMAGE.blobUrl,
              blobPathname: VALID_IMAGE.blobPathname,
            },
          ] as unknown as SingleOnlyState["uploadedImages"],
        },
      });

      render(wrapped());

      expect(screen.queryByTestId("image-gallery")).not.toBeInTheDocument();
    });

    it("renders no gallery when the image array is empty", () => {
      seedDraft({ single: { uploadedImages: [] } });

      render(wrapped());

      expect(screen.queryByTestId("image-gallery")).not.toBeInTheDocument();
    });
  });

  describe("draft preserved on error, cleared on success", () => {
    it("keeps the draft in localStorage after a failed submission", async () => {
      const user = userEvent.setup();

      mockUseActionState.mockReturnValue(idleState({ error: undefined }));
      const { rerender } = render(wrapped());

      await user.type(screen.getByLabelText("First Name"), "Alan");

      // Simulate a failed action: state has an error but NOT success
      mockUseActionState.mockReturnValue(
        idleState({ error: "Server error: 504" })
      );
      rerender(wrapped());

      expect(localStorage.getItem(REPORT_DRAFT_KEY)).not.toBeNull();
    });

    it("clears the draft in localStorage on successful submission", async () => {
      const user = userEvent.setup();

      mockUseActionState.mockReturnValue(idleState());
      const { rerender } = render(wrapped());

      await user.type(screen.getByLabelText("First Name"), "Grace");
      expect(localStorage.getItem(REPORT_DRAFT_KEY)).not.toBeNull();

      // Simulate success — the form calls clearAll(), which wipes the draft.
      mockUseActionState.mockReturnValue(idleState({ success: true }));
      rerender(wrapped());

      expect(localStorage.getItem(REPORT_DRAFT_KEY)).toBeNull();
    });

    it("clears firstName/lastName/email on success", () => {
      seedDraft({
        single: {
          firstName: "Grace",
          lastName: "Hopper",
          email: "grace@example.com",
        },
      });

      mockUseActionState.mockReturnValue(idleState());
      const { rerender } = render(wrapped());

      expect(screen.getByLabelText("First Name")).toHaveValue("Grace");

      mockUseActionState.mockReturnValue(idleState({ success: true }));
      rerender(wrapped());

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
      seedDraft({ single: { uploadedImages: [VALID_IMAGE] } });

      mockUseActionState.mockReturnValue(idleState());
      render(wrapped());

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
