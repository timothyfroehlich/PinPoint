# Tiptap Rich Text Editor & @Mentions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a rich text editor with @mentions to issue descriptions, comments, and machine text fields.

**Architecture:** Shared `<RichTextEditor>` component backed by Tiptap (headless ProseMirror). Content stored as ProseMirror JSON in JSONB columns. Server-side rendering via `generateHTML()`. @mentions trigger notifications through the existing notification pipeline.

**Tech Stack:** Tiptap (React), ProseMirror JSON, Drizzle ORM (JSONB), sanitize-html

---

## Status Update (2026-03-08)

Tasks 1-13 are committed. There are unstaged changes that need to be fixed before the branch
can pass preflight. **Skip to "Remaining Work" below.**

### What's committed and done:

- [x] Task 1: Tiptap packages installed
- [x] Task 2: ProseMirror JSON types + utilities (`src/lib/tiptap/types.ts`)
- [x] Task 3: DB migration — JSONB columns (migrations 0021, 0022)
- [x] Task 4: DB migration — notification schema ("mentioned" type + prefs)
- [x] Task 5: Server-side rendering (`src/lib/tiptap/render.ts`) — **has bugs, see fix below**
- [x] Task 6: Mention user search action (`src/app/(app)/mentions/actions.ts`)
- [x] Task 7: RichTextEditor component (`src/components/editor/RichTextEditor.tsx`)
- [x] Task 8: RichTextDisplay component (`src/components/editor/RichTextDisplay.tsx`)
- [x] Task 9: Report form integration — **partially broken, see fix below**
- [x] Task 10: Comment form + timeline integration
- [x] Task 11: Inline editable field integration
- [x] Task 12: Notification formatting for rich content
- [x] Task 13: Notification preferences UI (settings page toggles)

### What's broken (unstaged changes from Gemini):

1. `render.ts`: Removed `sanitize-html` — **security regression** (XSS via innerHTML)
2. `render.ts`: Removed `"server-only"` — **this was actually correct** (see below)
3. `unified-report-form.tsx`: Disabled the editor but kept the import — **TS6133 error**
4. `page.tsx`: Wrapped in pointless try/catch — **noise**
5. Tests fail: `generateHTML` in jsdom adds xmlns attributes that sanitize-html would strip

### What's valid in the unstaged changes (keep these):

- Dynamic imports (`next/dynamic`) in AddCommentForm, IssueTimeline, InlineEditableField
- `"mentioned"` case in NotificationList
- `wrapTextInProseMirror` helper in seed-users.mjs

---

## Remaining Work

### Fix A: Revert `page.tsx`

Run: `git checkout HEAD -- src/app/report/page.tsx`

Gemini wrapped the entire function body in a try/catch that just rethrows. Pointless.

---

### Fix B: Fix `render.ts` — Restore sanitization, keep NO `"server-only"`

**File**: `src/lib/tiptap/render.ts`

**CRITICAL CONTEXT**: The original committed code had `import "server-only"` which makes the
build fail because `RichTextDisplay` is imported by 3 `"use client"` components:

- `src/components/issues/IssueTimeline.tsx`
- `src/components/inline-editable-field.tsx`
- `src/components/machines/OwnerRequirementsCallout.tsx`

Gemini correctly removed `"server-only"` but incorrectly also removed `sanitize-html`.
The fix: restore `sanitize-html` but NOT `"server-only"`.

Replace the entire file with:

```typescript
// src/lib/tiptap/render.ts
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import sanitizeHtml from "sanitize-html";
import type { ProseMirrorDoc } from "./types";

/**
 * Extensions used for server-side HTML generation.
 * Must match the extensions configured in the editor component.
 */
const renderExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
  }),
  Link.configure({
    openOnClick: false,
  }),
  Mention.configure({
    HTMLAttributes: { class: "mention" },
    renderHTML({ options, node }) {
      return [
        "a",
        {
          ...options.HTMLAttributes,
          href: `/profile/${String(node.attrs["id"])}`,
          "data-mention-id": String(node.attrs["id"]),
        },
        `@${String(node.attrs["label"] ?? node.attrs["id"])}`,
      ];
    },
  }),
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2",
    "h3",
    "p",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "a",
    "br",
    "span",
  ],
  allowedAttributes: {
    a: ["href", "class", "data-mention-id", "target", "rel"],
    span: ["class"],
  },
  allowedClasses: {
    a: ["text-link", "mention"],
    span: ["mention"],
  },
};

/**
 * Render ProseMirror JSON to sanitized HTML.
 *
 * Used for displaying rich text content in non-editor contexts:
 * issue timeline, machine detail pages, email notifications.
 *
 * Security: Output is sanitized via sanitize-html with strict tag/attribute allowlists.
 */
export function renderDocToHtml(doc: ProseMirrorDoc): string {
  try {
    const html = generateHTML(doc, renderExtensions);
    return sanitizeHtml(html, SANITIZE_OPTIONS);
  } catch (e) {
    console.error("renderDocToHtml failed", e);
    return "";
  }
}

/**
 * Render ProseMirror JSON to sanitized HTML suitable for email.
 * Strips profile links (not accessible in email context) and
 * converts mentions to bold text.
 */
export function renderDocToEmailHtml(doc: ProseMirrorDoc): string {
  try {
    const html = generateHTML(doc, renderExtensions);
    // Convert mention links to bold @name for email
    const emailHtml = html.replace(
      /<a[^>]*class="[^"]*mention[^"]*"[^>]*>(@[^<]+)<\/a>/g,
      "<strong>$1</strong>"
    );
    return sanitizeHtml(emailHtml, SANITIZE_OPTIONS);
  } catch (e) {
    console.error("renderDocToEmailHtml failed", e);
    return "";
  }
}
```

**No test changes needed** — sanitize-html strips xmlns and extra Tiptap attributes, fixing all 3 test failures.

---

### Fix C: Re-enable editor in `unified-report-form.tsx`

**File**: `src/app/report/unified-report-form.tsx`

Keep the `next/dynamic` import (lines 40-49). Fix the description section around line 383:

**Find**:

```tsx
                  <Label htmlFor="description" className="text-on-surface">
                    Description (Temporarily Disabled)
                  </Label>
                  <input
```

**Replace with**:

```tsx
                  <Label htmlFor="description" className="text-on-surface">
                    Description
                  </Label>
                  <RichTextEditor
                    content={description}
                    onChange={setDescription}
                    mentionsEnabled={userAuthenticated}
                    placeholder="Tell us what happened, and how often it occurs."
                    className="min-h-[80px]"
                  />
                  <input
```

---

### Task 14: Add Mention & Editor CSS

**File**: `src/app/globals.css`

Insert after line 115 (after the `@utility text-link` closing brace):

```css
/* Rich text editor - mention styling */
@utility mention {
  @apply text-primary font-semibold no-underline cursor-pointer transition-all duration-300;
  &:hover {
    text-decoration: underline;
    text-shadow: 0 0 8px
      color-mix(in srgb, var(--color-primary) 80%, transparent);
  }
}

/* Rich text editor - ProseMirror focus */
.ProseMirror:focus {
  outline: none;
}

/* Rich text editor - placeholder */
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--color-muted-foreground);
  pointer-events: none;
  height: 0;
}
```

---

### Clean up

- Delete `response.html` (empty untracked artifact): `rm response.html`

---

### Don't touch these files (stage as-is)

These unstaged changes from Gemini are valid:

- `src/components/inline-editable-field.tsx` — dynamic import of RichTextEditor
- `src/components/issues/AddCommentForm.tsx` — dynamic import of RichTextEditor
- `src/components/issues/IssueTimeline.tsx` — dynamic import of RichTextEditor
- `src/components/notifications/NotificationList.tsx` — added `"mentioned"` case
- `supabase/seed-users.mjs` — `wrapTextInProseMirror` helper for JSONB seed data

---

## Task 15: Preflight & Final Verification

**Step 1: Run full preflight**

Run: `pnpm run preflight`
Expected: All checks pass (types, lint, format, unit tests, build, integration tests)

**Step 2: Fix any issues**

Address any type errors, lint warnings, or test failures.

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "fix: address preflight issues for Tiptap integration"
```

**Step 4: Push**

```bash
git push -u origin claude/add-mentions-markdown-g8PoN
```

---

## Appendix: Key File Reference

| File                                                 | Purpose                                               |
| :--------------------------------------------------- | :---------------------------------------------------- |
| `src/lib/tiptap/types.ts`                            | ProseMirrorDoc types, extractMentions, plainTextToDoc |
| `src/lib/tiptap/render.ts`                           | Server-side generateHTML + sanitization               |
| `src/components/editor/RichTextEditor.tsx`           | Shared Tiptap editor component                        |
| `src/components/editor/EditorToolbar.tsx`            | Toolbar with formatting buttons                       |
| `src/components/editor/MentionList.tsx`              | Mention autocomplete popup                            |
| `src/components/editor/RichTextDisplay.tsx`          | Read-only rich content display                        |
| `src/app/(app)/mentions/actions.ts`                  | searchMentionableUsers server action                  |
| `src/server/db/schema.ts`                            | JSONB columns + notification enum                     |
| `src/lib/notifications.ts`                           | NotificationType + preference switch                  |
| `src/lib/notification-formatting.ts`                 | Email HTML for mentions                               |
| `src/app/report/unified-report-form.tsx`             | Report form integration                               |
| `src/components/issues/AddCommentForm.tsx`           | Comment form integration                              |
| `src/components/issues/IssueTimeline.tsx`            | Timeline display integration                          |
| `src/components/inline-editable-field.tsx`           | Inline edit integration                               |
| `src/app/(app)/m/[initials]/machine-text-fields.tsx` | Machine fields integration                            |
