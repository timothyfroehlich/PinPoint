# Browser Support & Modern Web Guidance

The Baseline Widely available floor (CORE-UI-005) and the `modern-web-guidance` lookup catalog.

## Browser Support

PinPoint targets **Baseline Widely available** — features cross-browser for ~2.5 years and safe without fallbacks. This is the canonical floor (CORE-UI-005); see `pinpoint-design-bible` §19 for the policy.

### In-scope today (reach for these directly)

| Feature                              | Baseline since |
| :----------------------------------- | :------------- |
| `<dialog>` + `.showModal()`          | Mar 2023       |
| Container queries (`@container`)     | Feb 2023       |
| `:has()`                             | Dec 2023       |
| `:user-valid` / `:user-invalid`      | Nov 2023       |
| `inert` attribute                    | Mar 2022       |
| `aspect-ratio`                       | Mar 2021       |
| `accent-color`                       | May 2022       |
| `fetchpriority` (img/script/link)    | Sep 2023       |
| CSS subgrid                          | Sep 2023       |
| `gap` on flexbox                     | Apr 2021       |
| `prefers-reduced-motion` (CSS query) | Jul 2020       |
| `focus-visible`                      | Mar 2022       |
| Native form validation + `required`  | (pre-Baseline) |
| `enterkeyhint` attribute             | Dec 2021       |
| Logical properties (`inline-start`)  | Mar 2023       |

### Newly available — defer unless opted in

Popover API (`popover="auto"`), View Transitions, anchor positioning, scroll-driven animations, `text-wrap: balance` mid-adoption, `interestfor`, the `closedby` attribute on `<dialog>`. These ship behind a per-feature opt-in documented in the design bible.

### How to check a feature's status

The Google Chrome `modern-web-guidance` catalog tags each guide with its Baseline status. Search the catalog first (see next section); if a guide recommends a non-Widely feature, use the guide's documented fallback or skip the recommendation.

## Modern Web Guidance Catalog

The `modern-web-guidance` plugin (Google Chrome marketplace; installed at `~/.claude/plugins/marketplaces/googlechrome/skills/modern-web-guidance/`) ships ~90 prescriptive guides — one per use case — and is PinPoint's canonical "is there a Widely-available primitive for this?" lookup tool.

### Use the catalog before implementing

```bash
# Search by intent
npx -y modern-web-guidance@latest search "<query>"

# Retrieve one or more guide bodies
npx -y modern-web-guidance@latest retrieve "<id>,<id2>"

# Browse the full catalog
npx -y modern-web-guidance@latest list
```

### Curated guide map (PinPoint use cases)

| When you're building...                  | Search / retrieve                                                       |
| :--------------------------------------- | :---------------------------------------------------------------------- |
| A sign-in / sign-up form                 | `autofill-sign-in-form`, `autofill-sign-up-form`, `forms`               |
| An address or anonymous-reporter form    | `autofill-address-form`, `forms`                                        |
| Post-interaction validation feedback     | `validate-input-after-interaction`, `required-field-feedback`           |
| Accessible error announcement            | `accessible-error-announcement`                                         |
| A modal / dialog / confirmation          | `html` §4, `light-dismiss-a-dialog`, `platform-controls-dismiss-dialog` |
| A mobile drawer / slide-in panel         | `navigation-drawer`                                                     |
| A tooltip on touch                       | `interest-triggered-tooltips` (most are Newly available — read)         |
| Image priority / LCP                     | `optimize-image-priority`, `optimize-preload-priority`                  |
| Skeletons, content-visibility            | `defer-rendering-heavy-content`                                         |
| Long-task scheduling / INP               | `break-up-long-tasks`, `identify-inp-causes`                            |
| Container-internal layout                | `css-layout`, `size-aware-styling`                                      |
| Conditional styles via DOM state         | `style-parent-with-has`                                                 |
| Hidden-but-findable content (accordions) | `search-hidden-content`                                                 |
| Reduced-motion / animation               | `accessibility` § Motion                                                |
| Table a11y                               | `accessibility` § Tables                                                |
| Skip-link / landmarks                    | `accessibility` § Landmarks, `html` §3                                  |

**Don't memorize**: re-search per task. The catalog is updated more often than this skill is.
