# Machine QR Codes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let people scan a QR on each machine that links directly to the public report form with that machine preselected, plus a downloadable/printable QR image for members.

**Architecture:** Server-generate per-machine QR images (PNG data URL) using the `qrcode` library and a helper that builds the absolute report URL via `getSiteUrl()`. Surface the QR on the machine detail page (Server Component) with a download link and visible target URL. Update the public report page to honor a `machineId` query param (and optional `source=qr`) so the scan preselects the correct machine; keep the form fully server-side and progressively enhanced.

**Tech Stack:** Next.js 16 Server Components, TypeScript strictest, Drizzle for machine lookup, `qrcode` for PNG generation, shadcn/ui cards/buttons, existing `getSiteUrl()` helper.

---

### Task 1: Add helpers for report URL + QR generation (TDD)

**Files:**

- Create: `src/lib/machines/report-url.ts`
- Create: `src/lib/machines/report-url.test.ts`
- Create: `src/lib/machines/qr.ts`
- Create: `src/lib/machines/qr.test.ts`
- Modify: `package.json` (add `qrcode` dependency)

**Step 1: Write failing tests for URL helper**

```typescript
// src/lib/machines/report-url.test.ts
import { describe, it, expect } from "vitest";
import { buildMachineReportUrl } from "./report-url";

describe("buildMachineReportUrl", () => {
  it("builds absolute URL with machineId and source=qr", () => {
    const url = buildMachineReportUrl({
      siteUrl: "https://pinpoint.dev",
      machineId: "uuid-123",
      source: "qr",
    });
    expect(url).toBe(
      "https://pinpoint.dev/report?machineId=uuid-123&source=qr"
    );
  });

  it("omits source when not provided", () => {
    const url = buildMachineReportUrl({
      siteUrl: "http://localhost:3000",
      machineId: "uuid-123",
    });
    expect(url).toBe("http://localhost:3000/report?machineId=uuid-123");
  });
});
```

**Step 2: Write failing tests for QR helper**

```typescript
// src/lib/machines/qr.test.ts
import { describe, it, expect } from "vitest";
import { generateQrPngDataUrl } from "./qr";

describe("generateQrPngDataUrl", () => {
  it("returns a PNG data URL", async () => {
    const dataUrl = await generateQrPngDataUrl("https://example.com/report");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
```

**Step 3: Run targeted unit tests (expect failures)**

- Command: `npm test -- src/lib/machines/report-url.test.ts src/lib/machines/qr.test.ts`

**Step 4: Add helpers + dependency**

- Add `qrcode` to `dependencies` in `package.json`.
- Implement `buildMachineReportUrl({ siteUrl, machineId, source })` using `new URL("/report", siteUrl)` + `searchParams`.
- Implement `generateQrPngDataUrl(url: string)` using `qrcode.toDataURL` (PNG, error correction M).

**Step 5: Re-run tests (expect pass)**

- Command: `npm test -- src/lib/machines/report-url.test.ts src/lib/machines/qr.test.ts`

---

### Task 2: Honor machineId in public report page

**Files:**

- Modify: `src/app/report/page.tsx`
- Modify: `src/app/report/actions.ts` (propagate source to logs if desired)
- Create: `src/app/report/default-machine.ts` (pure helper)
- Create: `src/app/report/default-machine.test.ts`

**Step 1: Write helper tests**

```typescript
// src/app/report/default-machine.test.ts
import { describe, it, expect } from "vitest";
import { resolveDefaultMachineId } from "./default-machine";

const machines = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
];

describe("resolveDefaultMachineId", () => {
  it("prefers matching machineId from query", () => {
    expect(resolveDefaultMachineId(machines, "b")).toBe("b");
  });
  it("falls back to first machine when query missing/invalid", () => {
    expect(resolveDefaultMachineId(machines, "missing")).toBe("a");
    expect(resolveDefaultMachineId(machines, undefined)).toBe("a");
  });
  it("returns empty string when no machines", () => {
    expect(resolveDefaultMachineId([], "a")).toBe("");
  });
});
```

**Step 2: Run tests (expect fail)**

- Command: `npm test -- src/app/report/default-machine.test.ts`

**Step 3: Implement helper + apply in page**

- Add `resolveDefaultMachineId(machines, requestedId)` pure function.
- Update `page.tsx` to read `machineId` and `source` from `searchParams` promise.
- Use helper to set `defaultValue` on `<select>`.
- Show a small callout like “Reporting for: <machine name> (from QR)” when source=qr and machineId matches, to reassure the user.

**Step 4: Optional: pass `source` through action logs**

- In `submitPublicIssueAction`, grab `formData.get("source")` (string) and include in `log.*` context; do not change validation schema since extra fields are ignored.

**Step 5: Re-run tests (expect pass)**

- Command: `npm test -- src/app/report/default-machine.test.ts`

---

### Task 3: Add QR section to machine detail page

**Files:**

- Modify: `src/app/(app)/m/[initials]/page.tsx`
- Create: `src/app/(app)/m/[initials]/qr-section.tsx`
- (If needed) Create: `src/components/machines/qr-card.tsx` for reuse

**Step 1: Fetch needed data**

- Extend machine query in `page.tsx` to include `id` (for report URL) and keep `initials`/`name`.

**Step 2: Build server component for QR**

- New `QrSection` component renders:
  - Heading “Scan to report”
  - Visible target URL (monospace, selectable) using `buildMachineReportUrl({ siteUrl: getSiteUrl(), machineId, source: "qr" })`
  - `<img src={qrDataUrl} alt={`QR code for reporting ${machine.name}`}/>` using `await generateQrPngDataUrl(reportUrl)`
  - Download button `<a href={qrDataUrl} download={`${machine.initials}-qr.png`}>Download PNG</a>`
  - Small note: “Scans open the public report form with this machine preselected.”

**Step 3: Insert section into machine detail layout**

- Place QR card below Machine Information card (before Issues) to keep it discoverable.

**Step 4: (Optional) Add copy-link button**

- If there is an existing copy-to-clipboard button component, reuse it; otherwise, skip to avoid new client component.

**Step 5: Smoke test in browser**

- Run `npm run dev`, open `/m/{initials}`, verify QR renders and download works.

---

### Task 4: Verification & quality gates

**Step 1: Targeted tests**

- `npm test -- src/lib/machines/report-url.test.ts src/lib/machines/qr.test.ts src/app/report/default-machine.test.ts`

**Step 2: Lint/typecheck quick pass**

- `npm run check`

**Step 3: Full gate before submit**

- `npm run preflight` (required by repo rules)

**Step 4: Summarize changes**

- Note new dependency, new helper files, public form behavior change, and where QR appears.

---

Plan complete and ready to execute with superpowers:executing-plans. Which execution approach do you want: (1) run it now in this session task-by-task, or (2) open a fresh session and use executing-plans there?
