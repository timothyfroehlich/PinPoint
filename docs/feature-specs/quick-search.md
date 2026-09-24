# Quick Search — Feature Spec

**Status: approved.**

**What this document is.** The requirements for PinPoint’s app-wide quick search for machines and issues. It describes intended behavior only. When code and this specification disagree, either the code is corrected or this document is amended.

**Related records.** Bead PP-b6g1 tracks implementation.

## 1. Concepts

- **1.1 Quick search** is an app-shell navigation surface for finding a machine or issue and opening it directly.
- **1.2 Search query** is the person’s trimmed text input.
- **1.3 Search result** is a concise summary of one viewable machine or issue linked to its existing detail page.
- **1.4 Exact identifier match** is a machine’s complete initials or an issue’s complete formatted identifier.
- **1.5 Open issue** is an issue whose status is not one of PinPoint’s closed statuses.

## 2. Availability and entry points

- **2.1** Quick search is available on every route rendered inside the standard application shell.
- **2.2** At desktop widths, the top bar presents a centered inline search field with results attached below it.
- **2.3** At mobile widths, Search replaces Dashboard in the bottom tab bar.
- **2.4** The PinPoint logo continues to link to Dashboard at every viewport width.
- **2.5** A conventional platform keyboard shortcut opens quick search from anywhere in the application shell.
- **2.6** Quick search is available to every access level that can view machines and issues.

## 3. Search scope

- **3.1** Machine results match machine name, initials, and model identity.
- **3.2** Issue results match formatted issue identifier, issue title, machine name, and machine initials.
- **3.3** Quick search does not match issue descriptions, comments, reporter identity, assignee identity, or email addresses.
- **3.4** Search includes every machine and issue the current viewer has permission to view.
- **3.5** Search includes both open and closed issues.

## 4. Results and ranking

- **4.1** Results are separated into Machine and Issue groups.
- **4.2** Each group returns at most five results.
- **4.3** Exact identifier matches rank ahead of prefix and contained-text matches.
- **4.4** Prefix matches rank ahead of contained-text matches.
- **4.5** Open issues rank ahead of closed issues when their textual match quality is otherwise equivalent.
- **4.6** Each machine result identifies the machine by name and initials.
- **4.7** Each issue result identifies the issue by formatted identifier, title, machine, and status.
- **4.8** Selecting a result closes quick search and navigates directly to that record’s existing detail page.
- **4.9** Quick search does not introduce a separate search-results page.

## 5. Interaction

- **5.1** Opening quick search immediately presents and focuses the search input without waiting for search data.
- **5.2** Search begins after the query contains at least two non-whitespace characters.
- **5.3** A person can move through results with arrow keys, open the selected result with Enter, and close quick search with Escape.
- **5.4** Closing mobile quick search restores focus to the element that opened it (the Search tab when tapped, or the previously focused element when opened by shortcut). On desktop, Escape closes results and leaves focus in the inline search field; moving focus away, including with Tab, closes results without returning focus to the field.
- **5.5** Quick search presents distinct initial, loading, empty, and failure states.
- **5.6** A failure leaves the search field and current query available for another attempt.
- **5.7** A response for an older query never replaces results for a newer query.
- **5.8** Desktop and mobile search use the same query behavior and produce the same results.

## 6. Accessibility and responsiveness

- **6.1** Search controls and results have visible, programmatic names that describe their effects.
- **6.2** Result-count changes use polite, debounced announcements rather than interrupting on every keystroke.
- **6.3** Keyboard focus remains contained within the open mobile search dialog.
- **6.4** Search remains usable at 200% text zoom and at PinPoint’s supported mobile and desktop widths.
- **6.5** The mobile Search control meets the app shell’s existing bottom-tab size and safe-area requirements.
- **6.6** Search never introduces horizontal page overflow.

## 7. Data and authorization

- **7.1** Search evaluates machine and issue viewing permissions on the server.
- **7.2** Search returns only the fields required to identify and navigate to a result.
- **7.3** Search work is bounded by the minimum query length and per-group result limits.
- **7.4** Search input is treated as data and cannot alter the structure or authorization scope of the underlying query.

## Known divergences

_None — the current implementation matches this spec._

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-22 | Clarified inline desktop search, focus behavior, failure state, and the mobile dialog focus boundary. |
| 2026-09-20 | Created the quick-search requirements for machines and issues. |
