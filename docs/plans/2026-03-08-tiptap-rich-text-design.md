# Tiptap Rich Text Editor & @Mentions Design

## Problem

PinPoint's text fields (issue descriptions, comments, machine notes) are plain text with no formatting or mention support. Users can't bold important details, create lists for troubleshooting steps, or @mention team members to draw their attention to issues.

## Decisions

| Aspect | Decision | Rationale |
| :--- | :--- | :--- |
| Editor | Tiptap (headless ProseMirror) | Well-lit path, modular, React-native |
| Storage | ProseMirror JSON in JSONB columns | Lossless round-trip, JSON operators, GIN-indexable |
| Rendering | `generateHTML()` server-side | Built-in Tiptap utility, no custom serializer |
| Mentions | Logged-in users only | Anonymous reporters get formatting but not @mentions |
| Mentionables | All active registered users | `status = 'active'` (excludes invited) |
| Static pages | Keep `markdown.ts` | Different concern (author-time vs user-time content) |

## Scope

Three surfaces get the Tiptap editor:

1. **Report form** (`/report`) — description field
2. **Issue comments** (`AddCommentForm`) — comment field
3. **Inline editable fields** (`InlineEditableField`) — machine description, tournament notes, owner requirements, owner notes

## Storage

### Column Migration

Convert affected TEXT columns to JSONB with a data migration:

**Issues table:**
- `description: text()` → `description: jsonb()`

**Issue comments table:**
- `content: text()` → `content: jsonb()`

**Machines table:**
- `description: text()` → `description: jsonb()`
- `tournamentNotes: text()` → `tournamentNotes: jsonb()`
- `ownerRequirements: text()` → `ownerRequirements: jsonb()`
- `ownerNotes: text()` → `ownerNotes: jsonb()`

**Migration strategy:** SQL migration converts existing plain text rows to minimal ProseMirror JSON:

```sql
UPDATE issues SET description = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', description)
      )
    )
  )
) WHERE description IS NOT NULL;
```

Multi-paragraph content (containing `\n\n`) should be split into separate paragraph nodes. Single newlines become hard breaks.

### Notification Schema

Add `'mentioned'` to the `notification_type` enum.

Add to notification preferences:
- `emailNotifyOnMentioned: boolean (default true)`
- `inAppNotifyOnMentioned: boolean (default true)`

### Drizzle Types

JSONB columns use `.$type<ProseMirrorDoc>()` annotation for type safety:

```typescript
type ProseMirrorDoc = {
  type: "doc";
  content: ProseMirrorNode[];
};
```

## Editor Component

### `<RichTextEditor>`

Single shared component used across all three surfaces.

```typescript
interface RichTextEditorProps {
  content: ProseMirrorDoc | null;
  onChange: (doc: ProseMirrorDoc) => void;
  mentionsEnabled: boolean;
  placeholder?: string;
  compact?: boolean;         // Shorter min-height for inline fields
  disabled?: boolean;
}
```

### Tiptap Extensions

- `StarterKit` — paragraphs, bold, italic, headings (`levels: [2, 3]`), bullet lists, ordered lists, hard breaks
- `Link` — paste-auto-linking, `openOnClick: false` in edit mode
- `Mention` — only loaded when `mentionsEnabled=true`
- `Placeholder` — ghost text

### Toolbar

Slim icon toolbar above the editor:

```
[ B ] [ I ] [ H2 ] [ • ] [ 1. ] [ 🔗 ] [ @ ]
```

- shadcn/ui-styled icon buttons
- `@` button only visible when `mentionsEnabled=true`
- In `compact` mode, toolbar is hidden until focus
- Markdown shortcuts still work as accelerators (`**bold**`, `## heading`, `- list`)

### Integration by Surface

| Surface | `mentionsEnabled` | `compact` | Notes |
| :--- | :--- | :--- | :--- |
| Report form description | `userAuthenticated` | `false` | Replaces `<Textarea>` |
| AddCommentForm | `true` | `false` | Always authenticated context |
| InlineEditableField | `true` | `true` | Click-to-edit: rendered HTML when collapsed, editor when editing |

## @Mentions

### User Search

Server action `searchMentionableUsers(query: string)`:
- Queries `userProfiles` where `status = 'active'` and name matches (case-insensitive `ILIKE`)
- Returns `{ id, name, avatarUrl }` — **no email** (non-negotiable #12)
- Requires authentication (`checkPermission()`)
- Client-side debounce: 300ms

### Mention Node

Tiptap Mention extension configured with:
- `HTMLAttributes: { class: "mention" }`
- `suggestion.items`: async function calling the server action
- `suggestion.render`: popup with avatar + name list (uses shadcn/ui Popover or custom)

Stored in JSON as:
```json
{ "type": "mention", "attrs": { "id": "user-uuid", "label": "Tim" } }
```

### Mention Extraction

Utility function `extractMentions(doc: ProseMirrorDoc): string[]` — walks the JSON tree for `type: "mention"` nodes, returns unique user IDs. Used by notification system on save.

## Notifications

When content is saved (issue created, comment added, description edited):

1. `extractMentions(doc)` → unique user IDs
2. Filter out the author
3. `createNotification()` with type `mentioned` for each mentioned user
4. Respects `emailNotifyOnMentioned` / `inAppNotifyOnMentioned` preferences
5. Respects `suppressOwnActions`

## Rendering (Non-Editor Contexts)

### `generateHTML()`

Tiptap's built-in utility converts ProseMirror JSON to HTML server-side. Used for:
- Issue timeline (comment display)
- Machine detail pages (description, notes)
- Email notifications

### Mention Rendering

The Mention extension renders as:
```html
<a href="/profile/{id}" class="mention" data-mention-id="{id}">@{label}</a>
```

### Sanitization

Output from `generateHTML()` is sanitized with `sanitize-html` using the same security model as `markdown.ts`:
- Allowed tags: `h2`, `h3`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `a`, `br`, `span`
- Allowed attributes: `a[href, class, data-mention-id]`, `span[class]`
- Allowed classes: `text-link`, `mention`

### `<RichTextDisplay>` Component

Read-only display component that uses `generateHTML()` → `sanitize-html` to produce safe HTML output. Content is sanitized server-side before reaching the client.

Used in timeline, machine detail, anywhere formatted content is displayed.

## Backward Compatibility

- Old plain text content is migrated to ProseMirror JSON in the DB migration
- No application-level format detection needed (JSONB column enforces JSON)
- `markdown.ts` remains untouched for help/static pages

## Package Dependencies

```
@tiptap/react
@tiptap/pm
@tiptap/starter-kit
@tiptap/extension-link
@tiptap/extension-mention
@tiptap/extension-placeholder
```

Bundle impact: ~40-50KB gzipped, client-side only (`"use client"` components).

## Out of Scope

- Image embedding in editor (keep existing separate `ImageUploadButton` + `ImageGallery` workflow)
- Code blocks (user opted to skip)
- Blockquotes
- CMS-editable static/help pages
