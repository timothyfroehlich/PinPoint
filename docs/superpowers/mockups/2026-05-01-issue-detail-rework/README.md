# Issue Detail Rework — Brainstorming Mockups

Preserved mockups from the brainstorming session that produced the [issue detail rework design](../../specs/2026-05-01-issue-detail-rework-design.md).

These are HTML **content fragments** that were authored to be served by the [`superpowers:brainstorming`](https://github.com/timothyfroehlich/PinPoint/blob/main/.claude/plugins/cache/claude-plugins-official/superpowers/) visual companion server, which wraps them in a frame template (header, CSS theme, click-to-select infrastructure). They render in isolation with degraded styling but the structural intent is visible.

## Decision Arc

The mockups follow the brainstorming arc chronologically. Each mockup represented a choice point; the file preserved here is the version that was on screen when that decision was made.

| #   | File                                                               | Purpose                                                                                                                                 | Resolution                                                                                        |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | [`issue-detail-competitive.html`](./issue-detail-competitive.html) | Side-by-side competitor research (GitHub, Linear, Asana, today's PinPoint) at desktop+mobile                                            | Anchored the conversation; revealed PinPoint's bespoke mobile strip is an anti-pattern            |
| 2   | [`mobile-metadata-strategy.html`](./mobile-metadata-strategy.html) | Four mobile metadata strategies (A reflow / B sidebar-on-top / C pill strip / D align-chrome)                                           | Picked **C: pill strip at every viewport**                                                        |
| 3   | [`header-status-placement.html`](./header-status-placement.html)   | Two status pill placements at desktop+mobile (Linear-style top-left vs hero top-right)                                                  | Picked **top-right hero**; later normalized into the metadata grid                                |
| 4   | [`pill-organization.html`](./pill-organization.html)               | Three organization patterns for the pill row (α reduce / β grouped / γ two-tier)                                                        | Picked **α: reduce + reorganize**                                                                 |
| 5   | [`authentic-issue-detail.html`](./authentic-issue-detail.html)     | First mockup built from the actual schema + real `STATUS_CONFIG` colors + real permissions                                              | Caught: machine isn't editable, no locations table, severity/frequency missing from prior mockups |
| 6   | [`labeled-directions.html`](./labeled-directions.html)             | D1 (horizontal labeled pills with chevrons) vs D2 (vertical labeled rows in main column), with sticky bottom composer pattern on mobile | Picked **D2: vertical labeled rows**; sticky composer **mobile-only, signed-in only**             |
| 7   | [`d2-final.html`](./d2-final.html)                                 | Final D2 with **container-query 2-column desktop / 1-column mobile** and Assignee row spanning both columns at desktop                  | Locked the structural design; informed the design doc                                             |

## Verifying Implementation Against These Mockups

Use these as visual references when implementing the design. The canonical decisions for what to build are in the [design doc](../../specs/2026-05-01-issue-detail-rework-design.md), not in the mockups — the mockups are _how we got there_, the doc is _what we're building_.

When checking an implementation against a mockup:

1. Compare structure (rows, columns, hierarchy) — should match `d2-final.html`
2. Verify color usage — pills must consume `STATUS_CONFIG` / `PRIORITY_CONFIG` / `SEVERITY_CONFIG` / `FREQUENCY_CONFIG` from `src/lib/issues/status.ts`, not the inline color classes used in the mockups
3. Container query threshold — design doc §6.2 specifies 40rem default; tunable
4. Touch target sizing — minimum 44pt row height (Apple HIG)
5. Sticky composer trigger → Sheet pattern — see design doc §5.3

## Viewing Locally

These mockups expect the [`superpowers:brainstorming`](../../../README.md) frame template to wrap them. To view with full styling:

```bash
# Start the brainstorm server pointing at this directory
~/.claude/plugins/cache/claude-plugins-official/superpowers/<version>/skills/brainstorming/scripts/start-server.sh \
  --project-dir docs/superpowers/mockups/2026-05-01-issue-detail-rework \
  --foreground

# Or open the served URL printed in the terminal
```

For a quick visual check, opening any mockup directly in a browser shows the structural layout (the pills' inline colors render correctly), though the page-level header chrome and selection indicators won't appear without the server frame.

## Status

These are **frozen artifacts** — historical record of the design decisions. Don't edit them. If a follow-up rework needs new mockups, create a new `docs/superpowers/mockups/<date>-<topic>/` directory.
