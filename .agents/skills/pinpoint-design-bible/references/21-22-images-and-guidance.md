# Image Loading & Modern Web Guidance (§21–§22)

Image `priority` / `sizes` discipline and the modern-web-guidance lookup map.

## 21. Image Loading Discipline

Image loading sits at the intersection of LCP, layout stability, and bandwidth. Next.js `<Image>` handles the heavy lifting (srcset, WebP/AVIF negotiation, lazy loading); PinPoint must opt in correctly on a per-image basis.

### `priority` is for the LCP candidate only (CORE-PERF-003)

`priority` emits `fetchpriority="high"` plus eager loading. The browser interprets this as "this image is critical to first paint." Every prioritized image deprioritizes every other resource — so adding `priority` to a non-LCP image actively hurts LCP.

| Place                              | Should `priority`?                           |
| :--------------------------------- | :------------------------------------------- |
| The largest above-the-fold image   | Yes — that's the LCP candidate               |
| 32px header logo                   | No — too small to be the LCP, downloads fast |
| Sidebar logo on a wide-only column | No — never the LCP, often below the fold     |
| Image inside a closed dialog/modal | No — not in the viewport at first paint      |
| Avatars in a list                  | No — many, all small, none the LCP           |
| Thumbnail in a gallery             | No — lazy is correct                         |

### `sizes` accompanies every responsive image

Without `sizes`, the browser assumes `100vw` and downloads the desktop-width variant on mobile. Always provide `sizes` for images that don't render at full viewport width:

```tsx
<Image
  src="/apc-logo.png"
  alt="APC logo"
  width={200}
  height={149}
  priority
  sizes="(max-width: 768px) 80vw, 200px"
/>
```

### Preconnect known image origins

Add `<link rel="preconnect">` in the root layout for any third-party image origin used during initial render (e.g., the Vercel Blob bucket subdomain). This eliminates DNS + TLS handshake on the first user-uploaded image.

```tsx
// src/app/layout.tsx <head>
<link
  rel="preconnect"
  href="https://<project>.public.blob.vercel-storage.com"
/>
```

### Don't `priority` images that render inside closed surfaces

A Client-Component `<Dialog>` is mounted before it opens; an `<Image priority>` inside that mount is fetched eagerly even though the dialog hasn't been opened yet. Use `priority` on the **gallery thumbnail's LCP candidate** if there is one, not on the modal's full-size image.

## 22. Modern Web Guidance Reference

The Google Chrome `modern-web-guidance` plugin is PinPoint's canonical lookup tool for "is there a Widely-available primitive for this?" Each guide is a prescriptive document with DOs/DON'Ts and a Baseline-status note. Use it at the start of any non-trivial UI work (CORE-UI-006).

### Three commands

```bash
npx -y modern-web-guidance@latest search "<query>"       # find guides by intent
npx -y modern-web-guidance@latest retrieve "<id>,<id2>"  # fetch full guide(s)
npx -y modern-web-guidance@latest list                   # browse the catalog
```

### What it covers

Search it by intent; don't look for a guide-ID index here. There used to be one, and it was the same defect as the Baseline table two sections up — pre-computing the tool's answer and caching it, in a table whose own footer told you not to trust it. Guide IDs are the plugin's data and rot on its release schedule, not ours.

The **domains** are durable, and knowing them is what tells you whether the tool is worth a call: forms and autofill, post-interaction validation timing, accessible error announcement, dialogs and light-dismiss, mobile drawers, image priority and LCP, deferred rendering of heavy content, long tasks and INP, container-query layout, conditional styling from DOM state, accessibility (motion, landmarks, focus) and table semantics.

If your task touches any of those, `search` first — the catalog is updated far more often than this document.
