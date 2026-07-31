# CORE-ARCH-002 scope decision — retire progressive enhancement, replace with honest failure

**Bead:** PP-nw80
**Date:** 2026-07-27
**Status:** Design approved, pending implementation

## Problem

CORE-ARCH-002 ("Progressive enhancement — forms work without JavaScript, always `<form action={serverAction}>`") was accumulating exceptions rather than being enforced. PP-0fvr made the cost concrete: a P0 bug in which every issue status/priority/severity/frequency change silently reverted about a second after it was made. The mechanism was React 19's automatic post-action form reset firing a `reset` listener that `@radix-ui/react-select` 2.3.3 attaches, replaying `onValueChange` with the stale initial value.

The native submission path that made the bug possible existed only to satisfy this rule — on Radix Selects that could never have worked without JavaScript in the first place. The rule cost a P0 and bought nothing.

This document records the audit that followed, the decision, and the reconciliation work.

## Audit findings

Three read-only investigations covered the codebase.

### What actually worked without JavaScript

Roughly 28 submission surfaces were classified. **Seven worked end-to-end.** All of them cluster in auth and account management: sign-in, forgot-password, reset-password, OAuth provider buttons, OAuth consent approve/deny, change-password, profile text fields, and connected-accounts link/unlink.

Everything else failed through one of three mechanisms:

- **JS-only value source.** A hidden input carries a value that only a Radix `onValueChange` or TipTap `onChange` ever writes. Without JS it stays frozen at its initial render value.
- **JS-only reachability.** The form is correctly shaped but lives inside a Dialog or DropdownMenu opened by an `onClick` handler, so it never renders at all. Machine editing, comment editing, invite-user, delete-account, and the PinballMap listing controls all fail this way.
- **Frozen `disabled`.** A submit button's `disabled` is computed from client state, baked into the SSR HTML, and never released.

**The headline finding: `/report` is unconditionally broken without JavaScript** — the public, QR-reachable, anonymous entry point with the strongest claim on a no-JS guarantee. `entries[0].machineId` starts empty even on a `/report?machine=ABC` deep link, because `report-draft-store.tsx` deliberately starts blank to match SSR hydration and only applies the query parameter from a post-mount effect. The submit button's `disabled` includes `!entry.machineId`, frozen true. The rule's flagship surface was the one it protected least.

### What the rule cost

- **A P0 bug** (PP-0fvr), described above.
- **The same bug class, four more times over.** `update-machine-form.tsx` wraps an uncontrolled Name input and a Radix Availability Select in `<form action={formAction}>`. React 19 schedules the form reset on every action dispatch regardless of outcome. On success the dialog closes before anything is visible; on a _validation failure_ the dialog stays open and both fields silently reset to their pre-edit values underneath the error banner. This audit recorded it as an unfiled defect; it was in fact already being fixed in parallel as **PP-1ajq (PR #1751)**, which found the same bug in three further surfaces — create-machine, unified-report, and delete-account — and added a regression test per surface. That PR independently reached this audit's conclusion, rewriting the carve-out list as "every form that contains a Radix Select" and noting the list had become descriptive rather than a set of waivers. Its author also confirmed the `/report` finding below from the other direction: an unauthenticated no-JS reporter never receives a Turnstile token.
- **Fragile shapes.** `requestSubmit()` called from effects and handlers to simulate native submission; hidden mirror inputs whose only job is to carry React state into a native submit; a single file (`update-machine-form.tsx`) using two different dispatch mechanisms for different sub-flows, the second justified in a comment as avoiding "the DOM `requestSubmit()` → `useActionState` wiring uncertainty."
- **Undocumented divergence larger than the documented carve-outs.** The entire machine-settings surface (`InlineEditableText`, `InlineMarkdownField`, `NoteSection`, `DipBankSection`, `TableSection`, `SettingsSetCard`) has zero `<form>` elements — a debounced autosave model argued as a sanctioned exception in a plan doc that never reached the catalog. `machine-presence-select.tsx` is a silent violation nobody thought needed an exception.
- **An adjacent rule pointing the opposite way.** CORE-ARCH-006 _mandates_ `onSelect` plus a direct async call inside dropdown menus, precisely because forms break there. Two ARCH rules one number apart give opposite instructions once a Radix primitive is involved.

Every exception, documented or not, is triggered by a client-only Radix primitive that had no no-JS story to begin with.

### Whether no-JS was ever a real requirement

The rule has **no recorded rationale**. Its "Why" field restates its title. Git archaeology places the progressive-enhancement language in the original RSC-migration and Server-Actions commits, predating `docs/NON_NEGOTIABLES.md` as a file — inherited Next.js App Router boilerplate, not a PinPoint-specific response to any incident or user need.

Four concerns are routinely bundled under "progressive enhancement." They pull apart cleanly:

| Concern                                 | Real for PinPoint?               | Does `<form action={serverAction}>` mitigate it?                         |
| :-------------------------------------- | :------------------------------- | :----------------------------------------------------------------------- |
| JS disabled by the user                 | No evidence of such a population | No — the field widgets are inert either way                              |
| Bundle failed to load / hydration error | Plausible                        | No — same widgets, same inertness                                        |
| Slow or flaky network                   | The venue's genuine risk         | No                                                                       |
| Submit before hydration completes       | Marginal                         | In principle yes; not here, since field values require JS state to exist |

The rule targeted the two least relevant risks. The one that matters — network conditions in a pinball hall — has no infrastructure addressing it at all (no service worker, no offline support, no client retry, no optimistic UI), and native form wiring does not help it.

### The one surface that did it properly

`connected-account-row.tsx` ships an explicit `<noscript><form action={unlinkAction}>` fallback with a comment citing the non-negotiable. It is the only place in the codebase that _engineered_ progressive enhancement rather than assuming the markup shape delivered it.

That is the crux of the whole finding: **the rule measured a proxy — does this have `action={serverAction}` — and the proxy stopped correlating with the property it stood for.** `/report` passes the written test and fails the real one completely.

## Decision

**Retire CORE-ARCH-002. Do not replace it with a narrowed progressive-enhancement rule.**

The audited answer to "which surfaces must work without JavaScript" is **none**. PinPoint is an authenticated tool for roughly 20 members of a physical club, on known devices, on the club's own wifi. No-JS is not a supported mode and no work is owed to preserve it.

Two things are explicitly _not_ lost by retiring it:

- **Server actions remain the submission path**, guaranteed by CORE-ARCH-001 (server-first), CORE-ARCH-005 (direct server action references), and CORE-ARCH-007 (`useActionState` for feedback). The architectural benefit was never coming from CORE-ARCH-002.
- **Auth and OAuth forms keep working natively.** That is convention and a happy accident of using plain inputs, not a guarantee. If a future change breaks it, that is not a violation of anything.

### Why not narrow the rule to `/report`

The hydration window only protects interactions faster than hydration. Filling out an issue report — selecting a machine, describing the fault, clearing the captcha — takes tens of seconds; hydration completes in a few hundred milliseconds on the club's network. The user cannot reach the submit button inside the window. And if JavaScript never arrives at all, the accepted behavior is to fail visibly, which also does not want native submission. The protection pays out in neither branch.

Buying it anyway would mean rebuilding the machine combobox as a native `<select>`, replacing TipTap with a plain textarea, and finding a non-JS captcha path — substantial work protecting a window no user can act inside.

### What replaces it

A single narrow rule covering the one failure mode with real user cost.

**CORE-ARCH-012: A control that cannot act must not report that it did**

- **Severity:** Required
- **Why:** PinPoint does not support JavaScript-disabled browsers, and a visibly broken control is an acceptable outcome when JavaScript fails to load — the user can see something is wrong and retry. What is not acceptable is a control that reports success for an action it could not perform: the user walks away believing the change was saved. Visible breakage is recoverable; false confirmation is not.
- **Do:** When a control cannot perform its action — a dependency is unavailable, JavaScript is not running, a precondition is unmet — let it visibly do nothing, or surface a real error. Rely on server-side validation to reject submissions that could not have carried valid input.
- **Don't:** Render a success message, toast, or confirmation for a submission whose input could not have been collected. Don't wire a save control that submits unchanged state and confirms it as a change.

This is forward-looking guidance, not a cleanup mandate. The audit found no case that clearly violates it today. The nearest candidates — the notification-preferences page and the Discord `enabled` toggle, where a no-JS user cannot operate the toggles and a save reports success — are marginal: the toggles do not visually move, so the user is not shown a false state change, and the action truthfully saved what was submitted.

## Implementation

Doc-only. The bead states this is not a code task.

### 1. Retire CORE-ARCH-002

Follow the existing CORE-ARCH-003 precedent: remove the rule body from `docs/NON_NEGOTIABLES.md` and note the retirement in the appendix range. Both sanctioned exceptions go with it — PP-sn34's quick-report grid and PP-0fvr's four metadata forms stop being exceptions the moment the rule they except from is gone.

Retire rather than repurpose the ID. Historical specs under `docs/superpowers/` cite CORE-ARCH-002; those are dated records and stay untouched, so the ID must keep meaning what it meant when they were written.

### 2. Add CORE-ARCH-012

New ID rather than reusing 002, for the reason above. Wording as specified in the section above.

### 3. Fix the appendix range

The Rule IDs appendix currently reads `CORE-ARCH-001..010: Architecture (003 retired)`. It is already stale — CORE-ARCH-011 exists. Update to cover 012 and note both retirements.

### 4. Reconcile the citing surfaces

`scripts/check_rule_ids.py` errors on any citation of a rule ID absent from the catalog, and runs inside `pnpm run check`. It scans `CLAUDE.md`, `AGENTS.md`, `CODE_REVIEW.md`, `.claude/rules/*.md`, `.github/copilot-instructions.md`, and `.github/instructions/*.md`. Two live citations must change:

- `AGENTS.md` §2.1 item 4 — currently states the progressive-enhancement rule and both carve-outs. Replace with the CORE-ARCH-012 one-liner.
- `.github/instructions/components.instructions.md` — the "Progressive enhancement (CORE-ARCH-002)" section instructs Copilot to flag `onClick` handlers performing mutations a form action should own. Replace with review guidance for CORE-ARCH-012.

`docs/superpowers/` is not scanned, so historical specs and plans need no edits.

### 5. Clean two stale code comments

`src/app/(app)/admin/users/actions.ts` and `src/app/(app)/m/pinballmap-actions.ts` cite CORE-ARCH-002 in comments. Not gated by the checker, but they should not cite a retired rule. A third, `update-issue-priority-form.tsx`, claims "progressive enhancement" for a form that dispatches directly — factually wrong today, independent of this decision.

**Four more arrive with PP-1ajq (PR #1751)**, which adds sanctioned-exception comments citing CORE-ARCH-002 to `update-machine-form.tsx`, `create-machine-form.tsx`, `unified-report-form.tsx`, and `delete-account-section.tsx`. That PR must merge first (it fixes live user-visible bugs; this one is doc-only), after which those four are cleaned in the same sweep.

## Out of scope

- **No code changes to submission surfaces.** Nothing that currently works stops working.
- **No `aria-disabled` migration.** Preferring `aria-disabled` over native `disabled` for discoverability was considered and explicitly dropped: it is an ordinary accessibility improvement that stands on its own merits and is not justified by this bead's premise. In the no-JS scenario its benefit is thin — the tooltip that would explain the inactive control is itself a JS-dependent Radix component. For `/report`'s submit button specifically, native `disabled` is the better choice, since `aria-disabled` would permit a no-JS user to fire an empty submission and receive a confusing fail-closed captcha error.
- **No `no-js` class or inline head script.** Considered and rejected. Its headline advantage — zero flash — comes from a signal that answers the wrong question: an inline head script confirms JavaScript _ran_, not that React _hydrated_. In the CDN-failure case the mechanism is built for, the script executes, strips the class, and CSS marks everything enabled while the React bundle never arrives. It would also require new CSP nonce plumbing (`docs/SECURITY.md` documents the pattern; `x-nonce` is set in middleware and read nowhere in app code) on a production app with real user data, and would impose a paint flip on every user to serve none.
- **No network-resilience work.** Flaky-network handling is the venue's real risk and is genuinely unaddressed, but it is a separate body of work, not a rename of this rule.

### Verified during design

- **Hydration mismatches self-heal.** Confirmed against the installed react-dom 19.2.7: a mismatch or a throw during hydration causes React to discard and client-render the affected subtree rather than leaving dead server HTML. That failure mode needs no rule.
- **Bundle-never-loads is undetectable in-page.** The only code that could report it is inside the bundle that did not arrive. Any design premised on detecting it is unworkable; safe-by-default is the only option. `onRecoverableError` is owned by Next.js internally and is not exposed to app code in the App Router.

## Acceptance criteria

From the bead:

1. **CORE-ARCH-002 has an explicit, audited scope.** Satisfied: the audited answer is that no surface is required to work without JavaScript, with the reasoning recorded above.
2. **`docs/NON_NEGOTIABLES.md` and `AGENTS.md` agree.** Satisfied by items 1–4 of Implementation.
3. **The PP-0fvr carve-out is absorbed or removed.** Removed, along with the PP-sn34 carve-out.

Verification: `pnpm run check` passes, which includes `check:rule-ids` — the gate that would catch a dangling CORE-ARCH-002 citation.
