# Tiptap Rich Text Editor & @Mentions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a rich text editor with @mentions to issue descriptions, comments, and machine text fields.

**Architecture:** Shared `<RichTextEditor>` component backed by Tiptap (headless ProseMirror). Content stored as ProseMirror JSON in JSONB columns. Server-side rendering via `generateHTML()`. @mentions trigger notifications through the existing notification pipeline.

**Tech Stack:** Tiptap (React), ProseMirror JSON, Drizzle ORM (JSONB), sanitize-html

---

## Task 1: Install Tiptap Packages

**Files:**
- Modify: `package.json`

**Step 1: Install Tiptap dependencies**

Run:
```bash
pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-mention @tiptap/extension-placeholder
```

**Step 2: Verify installation**

Run: `pnpm run check`
Expected: PASS (no type or lint errors)

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add Tiptap editor dependencies"
```

---

## Task 2: Define ProseMirror JSON Types

**Files:**
- Create: `src/lib/tiptap/types.ts`
- Test: `src/lib/tiptap/types.test.ts`

**Step 1: Write the type definitions**

```typescript
// src/lib/tiptap/types.ts

/**
 * ProseMirror JSON document types for Tiptap editor content.
 *
 * These types represent the serialized form of editor content
 * stored in JSONB columns.
 */

export interface ProseMirrorMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: ProseMirrorMark[];
  text?: string;
}

export interface ProseMirrorDoc {
  type: "doc";
  content: ProseMirrorNode[];
}

/**
 * Convert plain text to a minimal ProseMirror document.
 * Splits on double newlines for paragraphs. Single newlines become hard breaks.
 */
export function plainTextToDoc(text: string): ProseMirrorDoc {
  const paragraphs = text.split(/\n\n+/);

  return {
    type: "doc",
    content: paragraphs.map((para) => {
      const lines = para.split("\n");
      const content: ProseMirrorNode[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) {
          content.push({ type: "text", text: lines[i] });
        }
        if (i < lines.length - 1) {
          content.push({ type: "hardBreak" });
        }
      }

      return {
        type: "paragraph",
        content: content.length > 0 ? content : undefined,
      };
    }),
  };
}

/**
 * Extract unique mentioned user IDs from a ProseMirror document.
 */
export function extractMentions(doc: ProseMirrorDoc): string[] {
  const ids = new Set<string>();

  function walk(nodes: ProseMirrorNode[]): void {
    for (const node of nodes) {
      if (node.type === "mention" && typeof node.attrs?.id === "string") {
        ids.add(node.attrs.id);
      }
      if (node.content) {
        walk(node.content);
      }
    }
  }

  walk(doc.content);
  return Array.from(ids);
}

/**
 * Extract plain text from a ProseMirror document (for search, truncation, etc.).
 */
export function docToPlainText(doc: ProseMirrorDoc): string {
  const parts: string[] = [];

  function walk(nodes: ProseMirrorNode[]): void {
    for (const node of nodes) {
      if (node.type === "text" && node.text) {
        parts.push(node.text);
      } else if (node.type === "mention" && node.attrs?.label) {
        parts.push(`@${String(node.attrs.label)}`);
      } else if (node.type === "hardBreak") {
        parts.push("\n");
      } else if (
        node.type === "paragraph" ||
        node.type === "heading" ||
        node.type === "bulletList" ||
        node.type === "orderedList"
      ) {
        if (parts.length > 0 && !parts[parts.length - 1]?.endsWith("\n")) {
          parts.push("\n");
        }
        if (node.content) walk(node.content);
        parts.push("\n");
        return;
      }
      if (node.content) walk(node.content);
    }
  }

  walk(doc.content);
  return parts.join("").trim();
}
```

**Step 2: Write tests**

```typescript
// src/lib/tiptap/types.test.ts
import { describe, expect, it } from "vitest";
import {
  plainTextToDoc,
  extractMentions,
  docToPlainText,
  type ProseMirrorDoc,
} from "./types";

describe("plainTextToDoc", () => {
  it("converts single line to one paragraph", () => {
    const doc = plainTextToDoc("Hello world");
    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    });
  });

  it("splits double newlines into paragraphs", () => {
    const doc = plainTextToDoc("First paragraph\n\nSecond paragraph");
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0]?.content?.[0]?.text).toBe("First paragraph");
    expect(doc.content[1]?.content?.[0]?.text).toBe("Second paragraph");
  });

  it("converts single newlines to hard breaks", () => {
    const doc = plainTextToDoc("Line 1\nLine 2");
    expect(doc.content).toHaveLength(1);
    const para = doc.content[0];
    expect(para?.content).toHaveLength(3);
    expect(para?.content?.[0]).toEqual({ type: "text", text: "Line 1" });
    expect(para?.content?.[1]).toEqual({ type: "hardBreak" });
    expect(para?.content?.[2]).toEqual({ type: "text", text: "Line 2" });
  });

  it("handles empty string", () => {
    const doc = plainTextToDoc("");
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0]?.content).toBeUndefined();
  });
});

describe("extractMentions", () => {
  it("returns empty array for doc with no mentions", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual([]);
  });

  it("extracts mention IDs from nested content", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hey " },
            {
              type: "mention",
              attrs: { id: "user-1", label: "Tim" },
            },
            { type: "text", text: " and " },
            {
              type: "mention",
              attrs: { id: "user-2", label: "Alex" },
            },
          ],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual(["user-1", "user-2"]);
  });

  it("deduplicates repeated mentions", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "user-1", label: "Tim" } },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "user-1", label: "Tim" } },
          ],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual(["user-1"]);
  });
});

describe("docToPlainText", () => {
  it("extracts text from paragraphs", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(docToPlainText(doc)).toBe("Hello world");
  });

  it("renders mentions as @label", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hey " },
            { type: "mention", attrs: { id: "user-1", label: "Tim" } },
          ],
        },
      ],
    };
    expect(docToPlainText(doc)).toBe("Hey @Tim");
  });
});
```

**Step 3: Run tests**

Run: `pnpm vitest run src/lib/tiptap/types.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/lib/tiptap/types.ts src/lib/tiptap/types.test.ts
git commit -m "feat: add ProseMirror JSON type definitions and utilities"
```

---

## Task 3: Database Migration — JSONB Columns

**Files:**
- Modify: `src/server/db/schema.ts` (lines 126-129, 171, 297)
- Create: New Drizzle migration via `pnpm db:generate`

**Step 1: Update schema — machines table**

In `src/server/db/schema.ts`, change the four machine text fields (lines 126-129) from `text()` to `jsonb().$type<ProseMirrorDoc>()`:

```typescript
// Before (lines 126-129):
description: text("description"),
tournamentNotes: text("tournament_notes"),
ownerRequirements: text("owner_requirements"),
ownerNotes: text("owner_notes"),

// After:
description: jsonb("description").$type<ProseMirrorDoc>(),
tournamentNotes: jsonb("tournament_notes").$type<ProseMirrorDoc>(),
ownerRequirements: jsonb("owner_requirements").$type<ProseMirrorDoc>(),
ownerNotes: jsonb("owner_notes").$type<ProseMirrorDoc>(),
```

Add the import at the top of the schema file:
```typescript
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
```

**Step 2: Update schema — issues table**

Change `description` (line 171):
```typescript
// Before:
description: text("description"),

// After:
description: jsonb("description").$type<ProseMirrorDoc>(),
```

**Step 3: Update schema — issueComments table**

Change `content` (line 297):
```typescript
// Before:
content: text("content").notNull(),

// After:
content: jsonb("content").$type<ProseMirrorDoc>().notNull(),
```

**Step 4: Generate Drizzle migration**

Run: `pnpm db:generate`

**Step 5: Edit the generated SQL migration**

The auto-generated migration will do `ALTER COLUMN ... SET DATA TYPE jsonb`. This will fail on existing text data. Edit the generated `.sql` file to first convert existing text to JSON, THEN alter the type.

Replace each generated `ALTER COLUMN` with a two-step approach:

```sql
-- Convert existing plain text to ProseMirror JSON before type change

-- machines.description
UPDATE "machines" SET "description" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "description")
      )
    )
  )
)
WHERE "description" IS NOT NULL;

ALTER TABLE "machines" ALTER COLUMN "description" SET DATA TYPE jsonb USING "description"::jsonb;

-- Repeat pattern for: machines.tournament_notes, machines.owner_requirements, machines.owner_notes

-- issues.description
UPDATE "issues" SET "description" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "description")
      )
    )
  )
)
WHERE "description" IS NOT NULL;

ALTER TABLE "issues" ALTER COLUMN "description" SET DATA TYPE jsonb USING "description"::jsonb;

-- issue_comments.content
UPDATE "issue_comments" SET "content" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "content")
      )
    )
  )
)
WHERE "content" IS NOT NULL;

ALTER TABLE "issue_comments" ALTER COLUMN "content" SET DATA TYPE jsonb USING "content"::jsonb;
```

**Note:** This simple migration wraps all text as a single paragraph. Multi-paragraph content (with `\n\n`) will display as one block but remain readable. A more sophisticated migration that splits on `\n\n` is possible but adds complexity — the simple approach is recommended for a first pass.

**Step 6: Run migration locally**

Run: `pnpm db:migrate`
Expected: Migration applies successfully.

**Step 7: Verify with db:generate**

Run: `pnpm db:generate`
Expected: "No schema changes" (schema matches DB).

**Step 8: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat: migrate description and content columns to JSONB for ProseMirror JSON"
```

---

## Task 4: Database Migration — Notification Schema

**Files:**
- Modify: `src/server/db/schema.ts` (lines 378-386 for enum, lines 441-474 for prefs)
- Modify: `src/lib/notifications.ts` (line 18 for type, lines 231-260 for switch)

**Step 1: Add 'mentioned' to notification type enum**

In `src/server/db/schema.ts`, line 379-385, add `"mentioned"`:
```typescript
type: text("type", {
  enum: [
    "issue_assigned",
    "issue_status_changed",
    "new_comment",
    "new_issue",
    "machine_ownership_changed",
    "mentioned",
  ],
}).notNull(),
```

**Step 2: Add mention preference toggles**

In `src/server/db/schema.ts`, after the new comment toggles (after line 446), add:

```typescript
    // Mentions
    emailNotifyOnMentioned: boolean("email_notify_on_mentioned")
      .notNull()
      .default(true),
    inAppNotifyOnMentioned: boolean("in_app_notify_on_mentioned")
      .notNull()
      .default(true),
```

**Step 3: Update TypeScript NotificationType**

In `src/lib/notifications.ts`, line 18-23, add `"mentioned"`:
```typescript
export type NotificationType =
  | "issue_assigned"
  | "issue_status_changed"
  | "new_comment"
  | "new_issue"
  | "machine_ownership_changed"
  | "mentioned";
```

**Step 4: Add 'mentioned' case to the preference switch**

In `src/lib/notifications.ts`, in the switch block (around line 253), add:
```typescript
      case "mentioned":
        emailNotify = prefs.emailNotifyOnMentioned;
        inAppNotify = prefs.inAppNotifyOnMentioned;
        break;
```

**Step 5: Generate and run migration**

Run: `pnpm db:generate && pnpm db:migrate`

**Step 6: Verify**

Run: `pnpm db:generate`
Expected: "No schema changes"

**Step 7: Commit**

```bash
git add src/server/db/schema.ts src/lib/notifications.ts drizzle/
git commit -m "feat: add 'mentioned' notification type and preference toggles"
```

---

## Task 5: Server-Side HTML Rendering Utility

**Files:**
- Create: `src/lib/tiptap/render.ts`
- Test: `src/lib/tiptap/render.test.ts`

This utility renders ProseMirror JSON to sanitized HTML for non-editor contexts (timeline, emails).

**Step 1: Write the rendering utility**

```typescript
// src/lib/tiptap/render.ts
import "server-only";
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
          href: `/profile/${String(node.attrs.id)}`,
          "data-mention-id": String(node.attrs.id),
        },
        `@${String(node.attrs.label ?? node.attrs.id)}`,
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
  const html = generateHTML(doc, renderExtensions);
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/**
 * Render ProseMirror JSON to sanitized HTML suitable for email.
 * Strips profile links (not accessible in email context) and
 * converts mentions to bold text.
 */
export function renderDocToEmailHtml(doc: ProseMirrorDoc): string {
  const html = generateHTML(doc, renderExtensions);
  // Convert mention links to bold @name for email
  const emailHtml = html.replace(
    /<a[^>]*class="[^"]*mention[^"]*"[^>]*>(@[^<]+)<\/a>/g,
    "<strong>$1</strong>"
  );
  return sanitizeHtml(emailHtml, SANITIZE_OPTIONS);
}
```

**Step 2: Write tests**

Test `renderDocToHtml` and `renderDocToEmailHtml` — verify:
- Simple paragraph renders to `<p>` tags
- Mentions render as profile links with correct href and class
- Script tags are stripped (XSS prevention)
- Email variant converts mentions to bold text without links

**Step 3: Run tests**

Run: `pnpm vitest run src/lib/tiptap/render.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/lib/tiptap/render.ts src/lib/tiptap/render.test.ts
git commit -m "feat: add server-side ProseMirror JSON to HTML rendering"
```

---

## Task 6: Mention User Search Server Action

**Files:**
- Create: `src/app/(app)/mentions/actions.ts`
- Test: integration test following existing patterns

**Step 1: Write the server action**

```typescript
// src/app/(app)/mentions/actions.ts
"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { ilike, and, eq, or } from "drizzle-orm";

interface MentionableUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Search for mentionable users by name.
 * Returns active registered users (excludes invited).
 * Requires authentication — anonymous users cannot search.
 */
export async function searchMentionableUsers(
  query: string
): Promise<MentionableUser[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    // Return a default list of active users (limited)
    return db.query.userProfiles.findMany({
      where: eq(userProfiles.status, "active"),
      columns: { id: true, name: true, avatarUrl: true },
      orderBy: (profile, { asc }) => [asc(profile.name)],
      limit: 10,
    });
  }

  const pattern = `%${trimmed}%`;
  return db.query.userProfiles.findMany({
    where: and(
      eq(userProfiles.status, "active"),
      or(
        ilike(userProfiles.name, pattern),
        ilike(userProfiles.firstName, pattern),
        ilike(userProfiles.lastName, pattern)
      )
    ),
    columns: { id: true, name: true, avatarUrl: true },
    orderBy: (profile, { asc }) => [asc(profile.name)],
    limit: 10,
  });
}
```

**Step 2: Write integration test**

Follow existing integration test patterns (check `src/test/integration/` for examples). Verify:
- Authenticated users get results
- Query filtering works by name
- Invited users are excluded from results
- Unauthenticated users get empty array
- No email addresses in response (non-negotiable #12)

**Step 3: Run tests**

Run: `pnpm vitest run src/app/\(app\)/mentions/`
Expected: PASS

**Step 4: Commit**

```bash
git add "src/app/(app)/mentions/"
git commit -m "feat: add searchMentionableUsers server action for @mention autocomplete"
```

---

## Task 7: RichTextEditor Component

**Files:**
- Create: `src/components/editor/RichTextEditor.tsx`
- Create: `src/components/editor/EditorToolbar.tsx`
- Create: `src/components/editor/MentionList.tsx`

This is the core shared editor component. See the design doc at `docs/plans/2026-03-08-tiptap-rich-text-design.md` for full component specs.

**Key implementation details:**

1. **MentionList** — A `forwardRef` component that handles keyboard navigation (ArrowUp/Down/Enter) and click selection. Renders avatar + name for each user.

2. **EditorToolbar** — Icon buttons for: Bold, Italic, H2, Bullet List, Ordered List, Link, @Mention. Uses lucide-react icons. `compact` prop hides toolbar until focus.

3. **RichTextEditor** — Main component wrapping `useEditor()` from `@tiptap/react`. Extensions: StarterKit (heading levels [2,3]), Link (autolink, openOnClick:false), Placeholder, and Mention (only when `mentionsEnabled=true`).

4. **Mention suggestion** — The `suggestion.items` function calls `searchMentionableUsers()` with 300ms debounce. The `suggestion.render` implementation should follow Tiptap's documented pattern using `tippy.js` or a React portal approach.

**Props interface:**
```typescript
interface RichTextEditorProps {
  content: ProseMirrorDoc | null;
  onChange: (doc: ProseMirrorDoc) => void;
  mentionsEnabled?: boolean;
  placeholder?: string;
  compact?: boolean;
  disabled?: boolean;
}
```

**Step 1: Implement all three components**

**Step 2: Run type check**

Run: `pnpm run check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/editor/
git commit -m "feat: add shared RichTextEditor component with toolbar and @mentions"
```

---

## Task 8: RichTextDisplay Component

**Files:**
- Create: `src/components/editor/RichTextDisplay.tsx`

A Server Component (no `"use client"`) that renders ProseMirror JSON to sanitized HTML using `renderDocToHtml()`. Used in issue timeline, machine detail pages, and anywhere stored content is displayed.

The component calls `renderDocToHtml()` which sanitizes via `sanitize-html` with strict allowlists, then renders the sanitized output.

**Step 1: Create the display component**

**Step 2: Commit**

```bash
git add src/components/editor/RichTextDisplay.tsx
git commit -m "feat: add RichTextDisplay component for rendering stored content"
```

---

## Task 9: Integrate — Report Form

**Files:**
- Modify: `src/app/report/unified-report-form.tsx` (lines 85, 374-387)
- Modify: `src/app/report/actions.ts` (line 218)
- Modify: `src/services/issues.ts` (CreateIssueParams type)

**Step 1: Replace the description Textarea with RichTextEditor**

In `unified-report-form.tsx`:
- Change `description` state from `string` to `ProseMirrorDoc | null`
- Replace the `<Textarea>` with `<RichTextEditor>` (mentionsEnabled={userAuthenticated})
- Serialize to hidden input as `JSON.stringify(description)`
- Update localStorage save/restore logic for JSON content

**Step 2: Update the server action**

In `src/app/report/actions.ts`, parse description from form as JSON, pass parsed `ProseMirrorDoc` to service.

**Step 3: Update the `createIssue` service**

Change `CreateIssueParams.description` from `string | null` to `ProseMirrorDoc | null`. After creating the issue, call `extractMentions()` on the description and fire `createNotification()` with type `"mentioned"` for any mentioned users.

**Step 4: Run checks**

Run: `pnpm run check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/report/ src/services/issues.ts
git commit -m "feat: integrate RichTextEditor into report form with @mentions"
```

---

## Task 10: Integrate — AddCommentForm

**Files:**
- Modify: `src/components/issues/AddCommentForm.tsx`
- Modify: `src/app/(app)/issues/actions.ts` (lines 619-695)
- Modify: `src/app/(app)/issues/schemas.ts` (line 105-113)
- Modify: `src/components/issues/IssueTimeline.tsx` (lines 322-325)

**Step 1: Replace Textarea with RichTextEditor in AddCommentForm**

Store content as `ProseMirrorDoc | null` state, serialize to hidden input as JSON string.

**Step 2: Update the Zod schema**

The `comment` field currently validates as `.string().min(1).max(5000)`. Change to accept a JSON string (increase or remove max length since JSON is larger than plain text).

**Step 3: Update the server action**

Parse comment JSON string into `ProseMirrorDoc` before passing to service. After saving, extract mentions and fire notifications.

**Step 4: Update timeline rendering**

In `src/components/issues/IssueTimeline.tsx` (lines 322-325), replace plain text rendering with `<RichTextDisplay content={event.content as ProseMirrorDoc} />`.

**Step 5: Run checks**

Run: `pnpm run check`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/issues/ src/app/\(app\)/issues/
git commit -m "feat: integrate RichTextEditor into comments with timeline display"
```

---

## Task 11: Integrate — InlineEditableField

**Files:**
- Modify: `src/components/inline-editable-field.tsx`
- Modify: `src/app/(app)/m/[initials]/machine-text-fields.tsx`
- Modify: `src/app/(app)/m/actions.ts` (machine update actions)

**Step 1: Update InlineEditableField to use rich text**

Change `editValue` from string to `ProseMirrorDoc | null`. In view mode, render with `<RichTextDisplay>`. In edit mode, show `<RichTextEditor compact>`.

The `onSave` callback signature changes from `(machineId: string, value: string)` to `(machineId: string, value: ProseMirrorDoc | null)`.

**Step 2: Update MachineTextFields props**

Change from `string | null` to `ProseMirrorDoc | null` for all four text fields.

**Step 3: Update machine update actions**

Accept `ProseMirrorDoc | null` instead of `string` in update functions.

**Step 4: Run checks**

Run: `pnpm run check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/inline-editable-field.tsx src/app/\(app\)/m/
git commit -m "feat: integrate RichTextEditor into machine inline editable fields"
```

---

## Task 12: Update Notification Formatting for Rich Content

**Files:**
- Modify: `src/lib/notification-formatting.ts` (lines 101-107)
- Modify: `src/lib/notifications.ts` (commentContent handling)

**Step 1: Update email formatting for new_comment**

In `notification-formatting.ts`, the `new_comment` case (line 101-107) currently sanitizes `commentContent` as plain text. Update to:
1. Parse `commentContent` as `ProseMirrorDoc` if it's JSON
2. Use `renderDocToEmailHtml()` to convert to email-safe HTML
3. Fallback to plain text sanitization for legacy content

**Step 2: Add 'mentioned' email formatting**

Add a new case:
```typescript
case "mentioned":
  body = `You were mentioned in a comment.`;
  break;
```

**Step 3: Update subject formatting**

Add a case for `"mentioned"`:
```typescript
case "mentioned":
  return `${machinePrefix}${formattedIssueId}: You were mentioned`;
```

**Step 4: Run checks**

Run: `pnpm run check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/notification-formatting.ts src/lib/notifications.ts
git commit -m "feat: update notification emails to render rich content and mentions"
```

---

## Task 13: Update Notification Preferences UI

**Files:**
- Locate: notification settings component in `src/app/(app)/settings/`
- Add mention toggles following existing pattern

**Step 1: Find the notification settings component**

Search for the component that renders notification preference toggles.

**Step 2: Add mention toggles**

Add `emailNotifyOnMentioned` and `inAppNotifyOnMentioned` toggles, following the existing pattern for other notification types.

**Step 3: Run checks**

Run: `pnpm run check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/\(app\)/settings/
git commit -m "feat: add mention notification toggles to settings page"
```

---

## Task 14: Add CSS for Mention Styling

**Files:**
- Modify: `src/app/globals.css` or relevant Tailwind layer

**Step 1: Add mention and editor styles**

```css
.mention {
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: none;
}

.mention:hover {
  text-decoration: underline;
}

.ProseMirror:focus {
  outline: none;
}
```

**Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add mention and Tiptap editor styles"
```

---

## Task 15: Preflight & Final Verification

**Step 1: Run full preflight**

Run: `pnpm run preflight`
Expected: All checks pass (types, lint, format, unit tests, build, integration tests)

**Step 2: Fix any issues**

Address any type errors, lint warnings, or test failures.

**Step 3: Manual smoke test**

- [ ] Create issue with bold, italic, heading, list formatting in description
- [ ] Verify description renders correctly on issue detail page
- [ ] Type `@` in comment — see user autocomplete popup
- [ ] Select a user — mention appears in editor with styling
- [ ] Submit comment — mention renders as link in timeline
- [ ] Check that mentioned user receives notification
- [ ] Edit a machine description — rich text editor appears
- [ ] Save — rich text renders in read mode
- [ ] Anonymous user sees editor toolbar but no @mention button
- [ ] Existing plain text content (migrated to JSON) displays correctly

**Step 4: Final commit if needed**

```bash
git add -A
git commit -m "fix: address preflight issues for Tiptap integration"
```

**Step 5: Push**

```bash
git push -u origin claude/add-mentions-markdown-g8PoN
```

---

## Appendix: Key File Reference

| File | Purpose |
| :--- | :--- |
| `src/lib/tiptap/types.ts` | ProseMirrorDoc types, extractMentions, plainTextToDoc |
| `src/lib/tiptap/render.ts` | Server-side generateHTML + sanitization |
| `src/components/editor/RichTextEditor.tsx` | Shared Tiptap editor component |
| `src/components/editor/EditorToolbar.tsx` | Toolbar with formatting buttons |
| `src/components/editor/MentionList.tsx` | Mention autocomplete popup |
| `src/components/editor/RichTextDisplay.tsx` | Read-only rich content display |
| `src/app/(app)/mentions/actions.ts` | searchMentionableUsers server action |
| `src/server/db/schema.ts` | JSONB columns + notification enum |
| `src/lib/notifications.ts` | NotificationType + preference switch |
| `src/lib/notification-formatting.ts` | Email HTML for mentions |
| `src/app/report/unified-report-form.tsx` | Report form integration |
| `src/components/issues/AddCommentForm.tsx` | Comment form integration |
| `src/components/issues/IssueTimeline.tsx` | Timeline display integration |
| `src/components/inline-editable-field.tsx` | Inline edit integration |
| `src/app/(app)/m/[initials]/machine-text-fields.tsx` | Machine fields integration |
