import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { randomUUID } from "node:crypto";
import {
  ReportDraftProvider,
  useReportDraft,
  entryHasContent,
} from "./report-draft-store";
import {
  REPORT_DRAFT_KEY,
  LEGACY_DRAFT_KEY,
  defaultEntry,
} from "./report-draft-schema";
import type { MachineOption } from "~/components/machines/MachineCombobox";

const MACHINE = randomUUID();
const machines: MachineOption[] = [
  { value: MACHINE, name: "Medieval Madness", initials: "MM" },
];
const assignees = [{ id: randomUUID(), name: "Tech" }];

// Test harness: surfaces store state + actions as data-testids / buttons.
function Harness(): React.JSX.Element {
  const d = useReportDraft();
  return (
    <div>
      <span data-testid="count">{d.contentRowCount}</span>
      <span data-testid="len">{d.entries.length}</span>
      <span data-testid="title0">{d.entries[0]?.title}</span>
      <span data-testid="machine0">{d.entries[0]?.machineId}</span>
      <span data-testid="key0">{d.entries[0]?.idempotencyKey}</span>
      <span data-testid="firstName">{d.single.firstName}</span>
      <button onClick={() => d.patchEntry(0, { title: "Sticky flipper" })}>
        set-title
      </button>
      <button onClick={() => d.patchEntry(0, { machineId: MACHINE })}>
        set-machine
      </button>
      <button
        onClick={() =>
          d.setEntries((prev) => [
            ...prev,
            { ...defaultEntry(randomUUID()), title: "Row 2" },
          ])
        }
      >
        add-row
      </button>
      <button onClick={() => d.patchSingle({ firstName: "Ada" })}>
        set-first
      </button>
      <button onClick={() => d.resetEntryZero()}>reset0</button>
      <button onClick={() => d.clearAll()}>clear</button>
    </div>
  );
}

function renderStore(): void {
  render(
    <ReportDraftProvider machines={machines} assignees={assignees}>
      <Harness />
    </ReportDraftProvider>
  );
}

const click = (label: string): void => {
  act(() => {
    screen.getByText(label).click();
  });
};

describe("ReportDraftProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("starts with one blank entry and zero content rows", () => {
    renderStore();
    expect(screen.getByTestId("len").textContent).toBe("1");
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("patchEntry updates a synced field", () => {
    renderStore();
    click("set-title");
    expect(screen.getByTestId("title0").textContent).toBe("Sticky flipper");
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("counts a row as content only with a machine or non-blank title", () => {
    expect(entryHasContent(defaultEntry("k"))).toBe(false);
    expect(entryHasContent({ ...defaultEntry("k"), title: "  " })).toBe(false);
    expect(entryHasContent({ ...defaultEntry("k"), title: "x" })).toBe(true);
    expect(entryHasContent({ ...defaultEntry("k"), machineId: MACHINE })).toBe(
      true
    );
  });

  it("setEntries appends a row and bumps the content count", () => {
    renderStore();
    click("set-machine"); // entry 0 now has content
    click("add-row"); // entry 1 has a title
    expect(screen.getByTestId("len").textContent).toBe("2");
    expect(screen.getByTestId("count").textContent).toBe("2");
  });

  it("patchSingle updates single-only state", () => {
    renderStore();
    click("set-first");
    expect(screen.getByTestId("firstName").textContent).toBe("Ada");
  });

  it("resetEntryZero blanks entry 0 with a fresh idempotency key", () => {
    renderStore();
    const key0 = screen.getByTestId("key0").textContent;
    click("set-title");
    click("reset0");
    expect(screen.getByTestId("title0").textContent).toBe("");
    expect(screen.getByTestId("key0").textContent).not.toBe(key0);
  });

  it("persists to localStorage on change", () => {
    renderStore();
    click("set-title");
    const raw = window.localStorage.getItem(REPORT_DRAFT_KEY);
    expect(raw).toContain("Sticky flipper");
  });

  it("clearAll wipes the draft and localStorage", () => {
    renderStore();
    click("set-title");
    click("clear");
    expect(screen.getByTestId("title0").textContent).toBe("");
    expect(screen.getByTestId("len").textContent).toBe("1");
    expect(window.localStorage.getItem(REPORT_DRAFT_KEY)).toBeNull();
  });

  it("hydrates from a seeded draft and drops a stale machineId", () => {
    const staleId = randomUUID(); // not in `machines`
    window.localStorage.setItem(
      REPORT_DRAFT_KEY,
      JSON.stringify({
        version: 2,
        entries: [
          { ...defaultEntry(randomUUID()), machineId: staleId, title: "Kept" },
        ],
        single: { firstName: "", lastName: "", email: "", uploadedImages: [] },
      })
    );
    renderStore();
    expect(screen.getByTestId("title0").textContent).toBe("Kept");
    expect(screen.getByTestId("machine0").textContent).toBe(""); // stale id dropped
  });

  it("migrates and retires a legacy report_form_state draft", () => {
    window.localStorage.setItem(
      LEGACY_DRAFT_KEY,
      JSON.stringify({
        machineId: MACHINE,
        title: "Legacy issue",
        idempotencyKey: randomUUID(),
      })
    );
    renderStore();
    expect(screen.getByTestId("title0").textContent).toBe("Legacy issue");
    expect(screen.getByTestId("machine0").textContent).toBe(MACHINE);
    expect(window.localStorage.getItem(LEGACY_DRAFT_KEY)).toBeNull();
  });
});
