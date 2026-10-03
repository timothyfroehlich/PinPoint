# Issue Detail Page — Feature Spec

**Status: draft.**

**What this document is.** The requirements for the issue detail page: the page for one issue, where people read the report and its activity, change the issue's fields, comment, and watch it. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** Approved Design canvas (https://claude.ai/artifact/L18rBFvGcNca8579kTnLSz, row 4, 2026-09-30) boards "4 · Issue tab — 320", "4 · Issue tab — 430", "4 · Details tab — 320", "4 · Other issues tab — 320" and the row-4 desktop board. `pinpoint-design-bible` §4 (Review Viewports, the 768px pivot), §5 (page archetypes), §24 (severity vocabulary). [reporting.md](reporting.md) (how an issue is created). [machine-scan-hub.md](machine-scan-hub.md) (the other per-machine open-issues surface). Beads PP-t4h1 (redesign build), PP-buwx (report photo bug), PP-5rne (share buttons, out of scope here).

---

## 1. Concepts

- **Issue detail page** — the page for one issue. One per issue, at the issue's own URL.
- **Issue ID** — the machine's initials plus the issue's number on that machine (GDZ-02). It identifies the issue in copy and in its URL; moving the issue to another machine gives it a new ID.
- **Header** — the block at the top of the page: Issue ID, machine name, title, the title and move actions, and the summary line. It is the same at every size except that on mobile Edit title and Move sit together in a ⋯ menu (§4.5).
- **Summary line** — a read-only line under the title stating the issue's assignee, status, severity, and priority.
- **Initial report** — what the reporter submitted: who reported it and when, the description, the frequency, and the photos attached at report time.
- **Activity** — everything that happened after the report, oldest first: comments and system events.
- **System event** — an entry PinPoint records when someone changes the issue: assignment, a status, severity, priority, frequency, or title change, a move to another machine, or a comment's deletion.
- **Field rows** — the issue's five editable fields as rows: Status, Severity, Priority, Frequency, Assignee. Each row opens that field's picker when the viewer can change that field.
- **Context rows** — read-only facts about the issue's surroundings: Machine, Owner, Reported, Updated, and Watching (which carries the Watch toggle).
- **Details** — the field rows and context rows together.
- **Other issues** — the machine's other open issues.
- **Owner's requirements** — instructions the machine's owner records on the machine, shown on each of its issues.
- **Watcher** — a signed-in person subscribed to notifications for the issue.
- **Section tabs** — on mobile only, the three tabs that split the page below the header: **Issue**, **Details**, **Other issues**. They are in-page state, not routes: the URL never names a tab.

---

## 2. Route & access

- **2.1** The page lives at `/m/<initials>/i/<number>`. The initials segment follows the machine routes' canonical-casing rule: a lowercase or mixed-case link redirects to the canonical URL.
- **2.2** When the number is not a positive whole number, or the machine has no issue with that number, the page shows an Issue not found page that offers Report an issue and Browse all issues.
- **2.3** Anyone can view the page signed out: the header, the initial report, Activity, Details, and Other issues.
- **2.4** After an issue moves to another machine it lives at its new URL; its old URL no longer shows it.
- **2.5** A link to a specific comment opens the page with that comment in view.
- **2.6** Arriving from any notification link — including one for a specific comment or a field change — opens the page scrolled to its target, on the Issue tab on mobile.

---

## 3. Capabilities

- **3.1** Changing the title, status, severity, or frequency requires the issue-reporting capability: members, technicians, and admins on any issue; guests only on issues they reported.
- **3.2** Changing the priority or the assignee requires the triage capability: members, technicians, and admins. Guests never have it, even on their own issues.
- **3.3** Moving the issue to another machine requires the move capability: technicians, admins, and the current machine's owner.
- **3.4** Commenting and watching require being signed in.
- **3.5** Only a comment's author can edit it.
- **3.6** A comment's author can delete it, and an admin can delete any comment. System events and the initial report can be neither edited nor deleted.
- **3.7** A control the viewer lacks the capability for is not offered: the Edit title and Move actions are absent (on mobile, so is the ⋯ menu when neither is available), and a field row shows its value without the › chevron, opens no picker, and gives no reason text.
- **3.8** The list of people who can be assigned is sent only to viewers with the triage capability.
- **3.9** People appear by name only — never by email (CORE-SEC-007). A report from someone without an account shows the name they gave, or Anonymous.

---

## 4. Header

- **4.1** The header's first row is the Issue ID chip followed by the machine's name, which links to the machine page. On mobile the ⋯ menu (§4.5) ends this row, so the title below has the full width.
- **4.2** The title follows, as the page's heading, shown in full and wrapping onto as many lines as it needs. No title is cut off, including older titles longer than the current limit.
- **4.3** On desktop an Edit title button sits beside the title and is always visible — never revealed only on hover. On mobile, Edit title is in the ⋯ menu (§4.5).
- **4.4** Edit title edits the title in place. On desktop, Enter saves, Escape cancels, and leaving the field cancels unless the save just failed. On mobile, Save and Cancel buttons sit under the field, the keyboard's Done key saves, and leaving the field keeps the edit open. An empty or unchanged title saves nothing. A title holds at most 60 characters, the same limit as when the issue is reported. An older title over 60 characters is never shortened automatically; it saves only once edited down to 60 or fewer.
- **4.5** On desktop a labeled Move button sits beside Edit title. On mobile a ⋯ menu at the end of the header's first row holds Edit title and Move to another machine, offering only the actions the viewer can use.
- **4.6** Move opens a dialog that lists every other machine not marked Removed, warns that the issue's URL will change, and on confirmation moves the issue and opens it at its new URL. The issue takes the next number on the destination machine; its old number is not reused.
- **4.7** The summary line sits under the title and states the assignee (or Unassigned), status, severity, and priority, each with its icon, with priority worded as "<level> priority". It wraps onto a second line when it doesn't fit. It is read-only.
- **4.8** Frequency is not in the header.
- **4.9** The header shows nothing else: the reporter, the machine's owner, the watcher count, the Watch toggle, and any updated time are not in it.
- **4.10** The page has no Back to Issues link at any size.

---

## 5. Initial report

- **5.1** The initial report opens with the reporter's name, an owner badge when the reporter is the machine's owner, and "reported <relative time>", with the exact time available on hover and on tap.
- **5.2** The description follows as plain body text — not inside a card, and without an "Initial report" label.
- **5.3** A frequency line follows the description: the word Frequency, the frequency's icon, and its value. With no frequency given, the line shows Not specified.
- **5.4** The photos attached at report time follow the frequency line. A comment's photos appear only with that comment.
- **5.5** Selecting a photo opens it full size.

---

## 6. Owner's requirements

- **6.1** When the machine has owner's requirements, they appear as a warning callout directly after the initial report, before Activity.
- **6.2** The callout is always shown in full — never collapsed or truncated.
- **6.3** Only signed-in viewers see the callout.
- **6.4** The callout's title reads Owner's requirements and does not name the machine.

---

## 7. Activity

- **7.1** Activity follows the owner's requirements (or the initial report when there are none), under an Activity heading at every size.
- **7.2** Activity lists comments and system events together, oldest first.
- **7.3** A Comments only toggle beside the heading hides system events while on. It starts off on every visit; the page never remembers it. It is absent while Activity has no entries.
- **7.4** A comment shows its author's name, an owner badge when the author is the machine's owner, its relative time with the exact time available on hover and on tap, an edited marker when it has been edited, its rich-text body, and its photos.
- **7.5** A system event is one line: who made the change, what changed (from → to where there is a before and after), and when.
- **7.6** System events are recorded for: assigning and unassigning; status, severity, priority, frequency, and title changes; moving the issue (from which Issue ID and machine to which); and a comment's deletion (by its author or by an admin).
- **7.7** Activity shows no avatars and no connecting line between entries.
- **7.8** With no comments, Activity shows an empty state inviting the first comment.
- **7.9** A comment's actions control offers Edit and Delete only to viewers who can use them, and is absent otherwise.
- **7.10** Editing a comment happens in place, with Save and Cancel.
- **7.11** Deleting a comment asks for confirmation. The deleted comment's place in Activity becomes a system event saying its author deleted it or an admin removed it, and its photos are removed.

---

## 8. Commenting

- **8.1** A signed-in viewer can comment with rich text, @mentions, and up to four photos.
- **8.2** On desktop the comment box sits inline at the end of Activity.
- **8.3** On mobile a floating Comment button sits above the bottom tab bar on the Issue tab only. It opens the comment composer in a sheet, which closes when the comment posts.
- **8.4** A signed-out visitor sees no comment box and no Comment button; a prompt to log in to comment takes the comment box's place at the end of Activity.
- **8.5** Posting a comment makes its author a watcher.
- **8.6** A retried submission of the same comment never posts it twice.
- **8.7** A signed-in person's unposted comment for an issue — its text and photos — is kept until it posts: closing the composer, switching tabs, or reloading the page restores it. Posting clears it.

---

## 9. Details

- **9.1** The field rows appear in the order Status, Severity, Priority, Frequency, Assignee. Each shows its label and its value with the value's icon.
- **9.2** Tapping a field row opens that field's picker. A choice saves immediately; if the save fails, the row returns to its previous value and an error is shown.
- **9.3** The Status picker offers every status, grouped as Open, In Progress, and Closed.
- **9.4** The Assignee picker is searchable and always offers the viewer themself and Unassigned alongside every assignable person.
- **9.5** The Owner context row shows the machine owner's name. A registered owner's name links to the issue list filtered to that owner's machines.
- **9.6** The Watching context row shows the watcher count and, for signed-in viewers, a Watch toggle that subscribes or unsubscribes them. Signed-out visitors see the count only.
- **9.7** The Machine context row shows the machine's name linking to the machine page. The Reported context row shows the reporter's name and the relative time of the report. The Updated context row shows the relative time of the issue's last change.

---

## 10. Other issues

- **10.1** Other issues lists the machine's open issues other than this one — an open issue is one whose status is outside the Closed group — each as the same issue card the machine page's Open Issues card uses, in the same compact presentation, and each opening its issue. Closed issues never appear.
- **10.2** On desktop the list's heading is **Other issues**. On mobile the Other issues tab has no heading of its own. Neither ever includes the machine's name.
- **10.3** The list carries a **See all** link that opens the issue list at `/issues` with only the machine filter set to this machine and no other filtering: every status (closed included) and the machine shown even when it is not On the Floor (`/issues?machine=<initials>&status=all&include_inactive_machines=true`).
- **10.4** The list carries no link to the machine page and no explanatory copy; the header's machine link serves as the way to the machine.
- **10.5** The list shows the five newest open issues, newest first; See all covers the rest.
- **10.6** With no other open issues, the list shows a No other open issues message, on the mobile tab and in the desktop section alike.

---

## 11. Mobile layout (below 768px)

- **11.1** The section tabs sit directly under the header: **Issue**, **Details**, **Other issues** followed by a count badge of other open issues, shown at 0 when there are none. A tab label never includes the machine's name. The Other issues tab is always present.
- **11.2** Issue is the default tab. Every arrival at the page — a typed or shared URL, a link within PinPoint, or a notification (§2.6) — opens the Issue tab.
- **11.3** The Issue tab shows the initial report (§5), the owner's requirements (§6), and Activity (§7).
- **11.4** The Details tab shows two cards: the field rows (§9.1), then the context rows Machine, Owner, Reported, Updated, and Watching.
- **11.5** The Other issues tab shows the Other issues list (§10).
- **11.6** At 320×568 the initial report begins above the fold on the Issue tab.
- **11.7** The section tabs are in-page state, not URL routes: no link ever opens the page on the Details or Other issues tab. The design bible's tab convention records this page as a deliberate exception.

---

## 12. Desktop layout (768px and wider)

- **12.1** The page has two panes, about 1120px wide in total: a main pane and a right column of about 320px.
- **12.2** The main pane holds the header, the initial report, the owner's requirements, Activity, and the inline comment box.
- **12.3** The right column holds Details — the field rows, then the context rows Machine, Owner, Reported, Updated, and Watching, the same rows as mobile's Details tab — followed by Other issues.
- **12.4** Desktop has no section tabs.
- **12.5** The design bible's page archetypes assign issue detail a two-pane layout with a right column.

---

## 13. Fit & touch

- **13.1** 320px wide is the layout floor: every control is reachable without horizontal scrolling, names wrap or truncate deliberately rather than clip, and titles always wrap (§4.2).
- **13.2** On mobile every tappable control has a touch target at least 44px in each dimension, the Comments only toggle, each comment's actions button, and each relative time included. A link inside a line of text, such as a person's or machine's name, is exempt, as WCAG 2.5.8 allows.

---

## 14. Out of scope

- **14.1** Sharing or copying a link to the issue is not part of this page's design; it is tracked separately as PP-5rne.

---

## Open questions

None.

---

## Known divergences (code vs spec)

| Requirement | Code today | Resolution |
| :-- | :-- | :-- |
| §4.6 | Move lists Removed machines. | PP-s363 |
| §5.4 | The report's photos include every photo on the issue, so a comment's photos also appear in the initial report. | PP-buwx |
| §2.2 | A number with trailing characters (`/i/1abc`, `/i/1.5`) is read as its leading digits and shows issue 1 instead of Issue not found. | PP-xlod |
| §2.5–§2.6 | Email and in-app notification links are the bare issue URL; only Discord links add the comment's anchor, and field-change notifications carry no system event id to anchor to. | PP-4g43 |

---

## Changelog

Changes to this document. Divergence-table rows are working state and are not logged here.

| Date | Change |
| :-- | :-- |
| 2026-10-03 | §4.6 Move leaves out Removed machines. |
| 2026-10-02 | §8.7 keeps an unposted comment draft, with its photos, until it posts. |
| 2026-10-02 | §1 Summary line and §4.7 add the assignee to the summary line, which may wrap to a second line; §4.1 and §4.5 move the mobile ⋯ menu to the end of the header's first row; §7.3 hides Comments only while Activity is empty. |
| 2026-10-01 | Design-review decisions: §4.4 gives mobile Save and Cancel buttons and keeps the edit open when the field loses focus; §5.1 and §7.4 make the exact time available on tap; §8.3 shows the Comment button on the Issue tab only; §11.1 shows the Other issues count as a badge; §13.2 adds relative times and exempts links inside a line of text. |
| 2026-10-01 | §1 Header, §3.7, §4.3, and §4.5: on mobile, Edit title and Move share a ⋯ menu beside the title; desktop keeps the always-visible Edit title button and a labeled Move button. |
| 2026-09-30 | Review fixes: §6.4 added (the callout's title does not name the machine); the Updated row joins §1 Context rows, §11.4, and §12.3, and desktop Details shows the same context rows as mobile (§12.4); §1 Header names the Move label exception; §1 Field rows open a picker only when the viewer can change the field; §13.1 always wraps titles; §11.7 and §12.5 state their requirement without describing the bible. |
| 2026-09-30 | Resolved open questions: §1 and §11.7 make the section tabs in-page state, a deliberate departure from the design bible's URL-driven tabs; §2.6 and §11.2 open every arrival, notifications included, on the Issue tab; §10.1, §10.3, §10.5, §10.6, and §11.1 define open, See all with only the machine filter (every status, off-floor machines included), the five newest first, and the empty state; §5.3 shows Not specified; §3.7 drops the chevron and reason text on fields the viewer can't change; §7.3 resets Comments only on every visit.; §4.2 shows the full title, wrapped; §4.4 sets the edit limit to 60 to match reporting; §9.7 adds an Updated row to Details; §13.2 holds the Comments only toggle and comment actions to 44px. |
| 2026-09-30 | Initial draft: route and access, capabilities, header with always-visible Edit title and a dedicated Move button, plain-text initial report with a frequency line, owner's requirements, Activity with a Comments only toggle, commenting, Details as field and context rows, Other issues, mobile section tabs, a two-pane desktop layout, and the 320px floor and 44px touch targets. |
