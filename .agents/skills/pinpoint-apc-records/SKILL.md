---
name: pinpoint-apc-records
description: Read the Austin Pinball Collective's Google Drive records — the Games and Maintenance sheet (the authoritative game→loaner roster) and the Official Membership Database — and reconcile them against PinPoint via the MCP server. Use when Tim relays a Discord message about a game changing hands, coming off the floor, arriving, or leaving; when a machine's owner in PinPoint is disputed or missing; when someone reports a name PinPoint cannot find; or whenever a request starts "make these updates for new games". Carries the same-origin fetch technique that makes reading a Google Sheet cheap instead of a screenshot-scraping session, and the name-matching traps that produce confident wrong answers.
---

# APC records → PinPoint

APC's source of truth for **who owns which game** is a Google Sheet, not PinPoint.
PinPoint is downstream. When the two disagree, the sheet wins unless Tim says
otherwise — see "Name matching" below, because the reflex to trust the freshest
Discord message is wrong often enough to be worth a rule.

## The two sheets

Both live under **Austin Pinball Collective Documents** (folder
`174aAI1OhapVgCnAgBg7VMDpFVAI_j4Cf`), shared with Tim's personal Google account.
There is **no Google Drive MCP connector** on this machine — the browser is the
only path. Do not waste a turn looking for one.

| What                             | File ID                                        | Key columns                                                                        |
| :------------------------------- | :--------------------------------------------- | :--------------------------------------------------------------------------------- |
| **Games and Maintenance**        | `1-hOLmXrt3CVsfM_7TXLoWQo_AuXSDGQFERlfFqEWEtk` | `GameName`, `Loaner`, `Start Date`, `Removed Date`, `Special Notes`, `PinPoint ID` |
| **Official Membership Database** | `1WYzK_0NPBTLR2gXaPlaap-4CHwlElbZYreL7YFGSAgc` | `Member Name` (col A); tabs `Members` / `No Longer Members`                        |

Parent folders: Game Loans & Maintenance `1SlMLYH9-fIa9n7uBF3ZDX1ZImSR6DTFU`,
Membership `1fog5mNU5vzMI_ARfDcguvuCO0Y8Iq4Od`.

`Loaner` is the owner. APC calls owners loaners because most games are on loan to
the collective — it is not a separate concept from PinPoint's `owner`.

The **`PinPoint ID` column exists and is empty on every row.** It is the obvious
place to record the initials once a game is matched, which would make every
future reconciliation a join instead of a fuzzy name match. Worth proposing to
Tim; do not fill it in unprompted.

## Reading a sheet without screenshotting it

Google Sheets renders to canvas, so `get_page_text` returns nothing and reading
the grid visually costs a screenshot per ~20 rows. Fetch the CSV export instead.

**The catch: `gviz` is same-origin-only.** Fetching it from a `drive.google.com`
tab fails CORS with a bare `TypeError: Failed to fetch`. Navigate the tab to the
spreadsheet first, _then_ fetch — the tab is on `docs.google.com` and the cookies
come along.

1. `navigate` to `https://docs.google.com/spreadsheets/d/<id>/edit`
2. **Wait ~6s.** Sheets is heavy; a `javascript_tool` call against a still-booting
   Sheets tab dies with a 45s CDP timeout, and a screenshot fails with a 5s
   injection timeout. One `computer{action:"wait"}` beats three failed calls.
3. `javascript_tool`:
   ```js
   const t = await (
     await fetch(
       `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=Members`,
       { credentials: "include" }
     )
   ).text();
   ```
   Omit `&sheet=` for the first tab.

Parse with a real CSV reader — `Special Notes` and `Value Notes` contain commas,
so `split(',')` silently corrupts every column after them.

**Filter inside the page and return only the columns you need.** The Games sheet
carries `Email`/`Phone` and the membership sheet carries phone, email and payment
method. Pulling whole rows drags member PII into the transcript for no reason.
Return `GameName | Loaner | Removed Date` and nothing else unless the task
genuinely needs more.

## Finding a file ID inside a Drive folder

Double-clicking a file opens it in a tab **outside** the MCP tab group, where you
cannot see it. Get the ID from the DOM instead and navigate directly:

```js
const el = [...document.querySelectorAll("*")].find(
  (e) =>
    e.children.length === 0 &&
    (e.textContent || "").trim() === "Games and Maintenance"
);
let n = el;
for (let i = 0; i < 8 && n; i++, n = n.parentElement) {
  const id = n.getAttribute?.("data-id");
  if (id && id.length > 20) return id;
}
```

A blanket `querySelectorAll('[data-id]')` sweep works only after the row list has
fully rendered, and returns just the breadcrumb folder before then. Walking up
from the filename text is reliable either way.

## Name matching — where this goes wrong

Three real traps, all of which produced a wrong answer on 2026-08-13:

- **The membership DB and the Games sheet spell the same person differently.**
  The membership roster says `Steve Jones`; the Games sheet says `Stephen Jones`
  on two rows. `set_machine_owner` takes the **PinPoint** spelling, which may
  match neither. Probe it and read the error — it names the failure precisely.
- **A Discord report is a claim, not a record.** Neil's floor-walk post said The
  30's belongs to Stephen Jones. The Games sheet says Bobbi Douthitt, and so did
  PinPoint. Two independent records outvoted the fresh message. Check the sheet
  before editing PinPoint on the strength of a Discord line.
- **APC membership ≠ PinPoint account.** Jonathan Morales is on the membership
  roster and is the Loaner of record for PIN-BOT, but `set_machine_owner` fails
  with `No member named "Jonathan Morales"` because he has no PinPoint account —
  or has one as a `guest`, and guests cannot own machines. There is no MCP tool
  to invite or promote; that is Tim's admin UI. Report it, don't work around it.

## The PinPoint side

Everything is `mcp__pinpoint__*`; there is **no member-list tool**, so the only
way to test whether a name resolves is to attempt `set_machine_owner` and read
the error.

- `list_machines` — `search`, `presence`, `pinballmap` filters. Read counts from
  `total`, never `count`. Its own description carries the offset-vs-mutation trap
  when you are acting on machines as you page them.
- `get_machine` — presence, owner, PBM link state, open issues
- `set_machine_owner` / `set_machine_availability` / `set_machine_name`
- `add_machine` — includes optional PBM link at creation
- `create_issue` / `update_issue` / `add_issue_comment` / `list_issues` / `get_issue`
- `search_pinballmap_catalog` — two-step family → editions

Presence vocabulary: `on_the_floor`, `off_the_floor`, `on_loan`,
`pending_arrival`, `removed`. A game pulled into a back room for repair is
`off_the_floor`. `removed` versus `on_loan` for a game that has left the building
is a judgment call Tim makes — ask rather than guess, they are not synonyms.

Every MCP write is audit-logged and acts as Tim's admin account, so a wrong write
is attributable to him. Reversible writes (owner, presence) are fine to make
directly once the sheet confirms them. `create_issue` notifies the owner — that
is outward-facing, so confirm before filing on someone's behalf.

## Doing an update pass

1. Pull `GameName | Loaner | Removed Date` from the Games sheet.
2. Pull the matching machines from `list_machines` (page with `offset` until
   `hasMore` is false).
3. Diff on owner and presence. Match names loosely — the sheet writes
   `The Machine: Bride of Pin-Bot`, PinPoint writes `The Machine: Bride of
PinBot`; `Al's Garage Band Goes On a World Tour` versus `...On World Tour`.
4. Apply only the differences the sheet supports. Report the rest as conflicts
   rather than picking a side.
5. Machines in the sheet but absent from PinPoint are `add_machine` candidates —
   confirm with Tim first, since a duplicate cabinet is easy to create and there
   is no delete tool.
