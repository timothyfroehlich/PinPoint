# Image Loading & Modern Web Guidance (§21–§22)

Image `priority` / `sizes` discipline and the modern-web-guidance lookup map.

## 21. Image Loading Discipline

Image loading sits at the intersection of LCP, layout stability, and bandwidth. Next.js `<Image>` handles the heavy lifting (srcset, WebP/AVIF negotiation, lazy loading); PinPoint must opt in correctly on a per-image basis.

### `priority` is for the LCP candidate only (CORE-PERF-003)

`priority` emits `fetchpriority="high"` (Baseline Widely available since Sep 2025) plus eager loading. The browser interprets this as "this image is critical to first paint." Every prioritized image deprioritizes every other resource — so adding `priority` to a non-LCP image actively hurts LCP.

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

### Guide map by PinPoint use case

| Building...                        | MWG search/retrieve                                                     |
| :--------------------------------- | :---------------------------------------------------------------------- |
| Sign-in / sign-up form             | `forms`, `autofill-sign-in-form`, `autofill-sign-up-form`               |
| Address or anonymous reporter form | `autofill-address-form`, `forms`                                        |
| Post-interaction validation        | `validate-input-after-interaction`, `required-field-feedback`           |
| Accessible error announcement      | `accessible-error-announcement`                                         |
| Modal / dialog / confirmation      | `html` §4, `light-dismiss-a-dialog`, `platform-controls-dismiss-dialog` |
| Mobile drawer / slide-in           | `navigation-drawer`                                                     |
| Tooltips on touch                  | `interest-triggered-tooltips` (most variants are Newly available)       |
| Image priority / LCP               | `optimize-image-priority`, `optimize-preload-priority`                  |
| Long-task / INP                    | `break-up-long-tasks`, `identify-inp-causes`                            |
| Container-internal layout          | `css-layout`, `size-aware-styling`                                      |
| Conditional styling via DOM state  | `style-parent-with-has`                                                 |
| Hidden-but-findable content        | `search-hidden-content`                                                 |
| Reduced-motion / animation         | `accessibility` § Motion                                                |
| Skip-link / landmarks / focus      | `accessibility`, `html` §3                                              |
| Tables                             | `accessibility` § Tables                                                |

Don't memorize the map — re-search per task. Plugin catalog updates more often than this document does.
