# Key Files, Components & Label Standards

The canonical pattern sources to read, plus field ordering and label conventions.

### Adding Components

```bash
pnpm exec shadcn@latest add [component]
```

### Issue Field Display Order

The canonical display order for issue metadata fields is:

1. Status
2. Priority
3. Severity
4. Frequency

When assignee is present in edit contexts, it comes first.

## Key Files Registry

These are the canonical pattern sources. Read these files to understand PinPoint's UI patterns -- they ARE the documentation.

### Status & Filter System

| File                                            | What It Teaches                                                                      |
| :---------------------------------------------- | :----------------------------------------------------------------------------------- |
| `src/lib/issues/status.ts`                      | STATUS_CONFIG, STATUS_GROUPS, color system, all 11 statuses. Single source of truth. |
| `src/components/issues/IssueFilters.tsx`        | Smart badge grouping, filter composition, MultiSelect usage, "More Filters" pattern  |
| `src/components/issues/fields/StatusSelect.tsx` | Grouped select with icons, STATUS_GROUP_LABELS, separator pattern                    |
| `src/components/ui/multi-select.tsx`            | Grouped/flat modes, indeterminate group headers, selected-items-first sorting        |

### Pickers & Selects

Single-select user pickers all follow the **Picker Pattern** (Popover + cmdk Command) — see `pinpoint-design-bible` §12 for the canonical pattern + rules. Don't reimplement; copy from one of these.

| File                                         | What It Teaches                                                                                     |
| :------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| `src/components/issues/AssigneePicker.tsx`   | Picker pattern, "Unassigned" sentinel, "Me" quick-select, callback-driven assignment via `onAssign` |
| `src/components/machines/OwnerSelect.tsx`    | Picker pattern, hide-guests toggle, invite-on-the-fly via `<InviteUserDialog>`                      |
| `src/components/machines/MachineFilters.tsx` | Inline filter bar (not a picker — filter composition + sort dropdown for the list page)             |

### Styling & Tokens

| File                                       | What It Teaches                                                             |
| :----------------------------------------- | :-------------------------------------------------------------------------- |
| `src/app/globals.css`                      | Material Design 3 color system, Tailwind v4 @theme block, custom properties |
| `src/lib/issues/status.ts` (STATUS_CONFIG) | Canonical color assignments per status (Tailwind class names)               |

### Layout

Every authenticated page should compose `<MainLayout>` → `<PageContainer>` → `<PageHeader>` → content. See `pinpoint-design-bible` §5 for the size mapping (narrow/standard/wide/full).

| File                                        | What It Teaches                                                                                                   |
| :------------------------------------------ | :---------------------------------------------------------------------------------------------------------------- |
| `src/components/layout/MainLayout.tsx`      | App shell (AppHeader + content + BottomTabBar), horizontal padding                                                |
| `src/components/layout/PageContainer.tsx`   | Width + vertical padding wrapper. `size="narrow" \| "standard" (default) \| "wide" \| "full"`                     |
| `src/components/layout/PageHeader.tsx`      | Page title (h1, text-balance, 3xl bold) + optional `titleAdornment` + optional `actions`. Bottom border separator |
| `src/components/layout/AppHeader.tsx`       | Unified responsive header (icon-only at md:, icon+text at lg:)                                                    |
| `src/components/layout/BottomTabBar.tsx`    | Mobile tab bar (md:hidden), More sheet with secondary nav                                                         |
| `src/components/layout/nav-config.ts`       | Shared NAV_ITEMS array used by AppHeader and BottomTabBar                                                         |
| `src/components/layout/HelpMenu.tsx`        | Help dropdown (Feedback, What's New, Help, About) with badge                                                      |
| `src/components/layout/ClientProviders.tsx` | Hoists `<TooltipProvider>` (`delayDuration={300}`) — don't add nested providers                                   |

## Label Standards

- Status group labels: import from `STATUS_GROUP_LABELS` in `src/lib/issues/status.ts` ("Open", "In Progress", "Closed"). Never hardcode the strings.
- Quick-select labels for "current user" filters are "Me" (assignee) and "My machines" (machines). Both shipped — see `AssigneePicker` and `MachineFilters`.
- Status `wait_owner`: use `STATUS_CONFIG.wait_owner.label` as the canonical display string (currently "Pending Owner"). Mockups occasionally use "Wait Owner"; the config wins.
