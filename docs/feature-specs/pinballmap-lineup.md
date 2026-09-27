# Pinball Map Lineup Page — Feature Spec

**Status: approved.**

**What this document is.** The requirements for the Pinball Map lineup page at `/m/pinball-map`: one page that compares, title by title, what PinPoint says the venue's Pinball Map lineup should be with what Pinball Map currently shows, and groups every difference by the action that resolves it. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/pinballmap.md` (the integration's concepts, the per-machine listing control, outbound actions, and permissions — this page reuses them and never redefines them), `docs/feature-specs/machine-views.md` (the machines list this page sits under), `docs/feature-specs/fleet.md`.

---

## 1. Concepts

Every concept in `pinballmap.md` §1 applies unchanged — match, uncataloged, listing intent, lineup, coverage, availability, edition near-miss, sync participation, tracked location. This page adds only the ones below.

- **Lineup page** — the page at `/m/pinball-map`. A read-and-reconcile surface for the tracked location; it configures nothing (configuration is `pinballmap.md` §10).
- **Title** — one Pinball Map catalog title. The page compares titles, not cabinets, because the lineup carries at most one entry per title (`pinballmap.md` §1, Lineup).
- **Title intent** — PinPoint's position on one title, derived from the listing intent of every cabinet matched to it: **On** when at least one cabinet is On the lineup; **Off** when none is On and at least one is Off the lineup; **Don't sync** when every cabinet is set to Don't sync. A title no PinPoint machine is matched to has no title intent.
- **Unmatched entry** — a lineup entry whose title no PinPoint machine is matched to.
- **Difference** — a title whose title intent and lineup disagree, or whose disagreement PinPoint cannot resolve without a person. Every difference belongs to exactly one fix group.
- **Fix group** — the action that resolves a difference: **To add**, **To remove**, **To update**, or **Needs a decision**. Two further groups hold titles that are not differences: **Worth a look** and **In sync**.
- **Comparison matrix** — a count of titles by title intent (On, Off, Don't sync, or no PinPoint machine) against lineup presence (on Pinball Map, not on Pinball Map).

## 2. The page and access

- **2.1** The lineup page lives at `/m/pinball-map`, under the machines list. The machines list and the admin menu link to it.
- **2.2** Viewing the page requires signed-in membership, the same tier that reads the listing control (`pinballmap.md` §8.3). Anonymous visitors and guests do not reach it.
- **2.3** The page renders only from stored data. Opening it never calls Pinball Map (`pinballmap.md` §3.4).
- **2.4** While the integration is **Not configured**, the page states that and shows no comparison, header refresh, or retained snapshot as current (`pinballmap.md` §10.6).
- **2.5** While the integration is **Waiting** (`pinballmap.md` §3.5), the page shows the header with its Refresh and error marker, and no comparison.

## 3. Header

- **3.1** The header names the tracked location, linked to its Pinball Map page (the attribution link-back, `pinballmap.md` §9.1).
- **3.2** The header shows the number of entries on the lineup and when PinPoint last refreshed it, with the shared, throttled Refresh (`pinballmap.md` §3.2).
- **3.3** The header shows the date Pinball Map last recorded an update to the location.
- **3.4** The header hosts **Confirm lineup on Pinball Map** under the rules of `pinballmap.md` §3.7.

## 4. Summary and comparison matrix

- **4.1** Above the matrix, the page states the total number of differences and the count in each fix group that has any.
- **4.2** The comparison matrix counts every title the page knows about — every title a PinPoint machine is matched to, plus every unmatched entry on the tracked location's lineup — exactly once. Entries at a previously tracked location are not on this lineup and appear only in their fix group (5.3).
- **4.3** Cells where the lineup matches the title intent (On and on Pinball Map; Off and not on Pinball Map) are styled as in sync. Cells where they disagree (On and not on Pinball Map; Off and on Pinball Map; no PinPoint machine and on Pinball Map) are styled as differences. Don't sync cells are neutral. The no-PinPoint-machine, not-on-Pinball-Map cell cannot hold a title and is shown as empty, not as zero.
- **4.4** Selecting a cell narrows the fix groups to titles in that cell; selecting it again, or clearing the selection, shows every title again. The selection round-trips through the URL.
- **4.5** A title that is on Pinball Map with title intent On still counts in the On, on-Pinball-Map cell when it lands in To update, Needs a decision, or Worth a look — the matrix counts lineup presence, the fix groups carry the rest.

## 5. Fix groups

- **5.1** Fix groups render in a fixed order — To add, To remove, To update, Needs a decision, Worth a look — each with its count and a one-line statement of what the group means. A group with no titles is not shown.
- **5.2** **To add** holds each title with title intent On that is not on Pinball Map, unless an edition near-miss explains it (5.5).
- **5.3** **To remove** holds each entry on Pinball Map that nothing in PinPoint keeps there: a title with title intent Off (Lingering, `pinballmap.md` §4.2); an entry left behind when its machine was re-matched (`pinballmap.md` §2.5); and an entry recorded at a previously tracked location (`pinballmap.md` §10.11).
- **5.4** **To update** holds each title on Pinball Map with title intent On whose Insider Connected target differs from Pinball Map's value (`pinballmap.md` §3.8).
- **5.5** **Needs a decision** holds each difference where PinPoint cannot tell which side is right:
  - a title with title intent On whose On cabinets include one whose availability disallows the lineup (Alert, `pinballmap.md` §4.2, §6.2);
  - an edition near-miss — a title with title intent On that is not on Pinball Map, paired with an unmatched entry in the same title family — shown as one row, not two;
  - any other unmatched entry, which is either a game PinPoint is missing or an entry that should not be there.
- **5.6** **Worth a look** holds each title on Pinball Map whose On cabinets include one with an advise-tier availability (Flag, `pinballmap.md` §6.5). It is not a difference and is not counted in 4.1.
- **5.7** Each row names the title, every PinPoint cabinet involved with its listing intent and availability, the reason in plain words, and the entry's comment count.
- **5.8** Each row offers the actions that resolve it. Outbound actions follow the listing control's rules exactly: the same capability and linked-account gates (`pinballmap.md` §8.2), the same confirmations (§4.5, §4.6), and the same no-credential guidance with a link to the location's Pinball Map page (§4.4). Match and intent changes follow the machine page's rules (`pinballmap.md` §2, §8.1).
- **5.9** The page offers no action that acts on several rows at once. Every outbound write is one explicit, confirmed action on one entry (`pinballmap.md` §3.3).

## 6. In sync and not compared

- **6.1** Titles in sync are collapsed to one count, split into on-Pinball-Map and not-on-Pinball-Map, and can be expanded to list them.
- **6.2** A footer states what the page does not compare: titles set to Don't sync; uncataloged machines; and machines without a catalog match, with those still in the collection listed apart from removed ones and linked to where they can be matched.
- **6.3** When no PinPoint cabinet carries an Insider Connected intent for an eligible title, the page compares nothing for that title's Insider Connected setting and states Pinball Map's values in the footer instead (`pinballmap.md` §3.8).

## 7. Vocabulary

- **7.1** `pinballmap.md` §4.8 applies: "listing" never appears; the object is an entry and the set is the lineup.
- **7.2** Intent is named with the listing control's own words — On the lineup, Off the lineup, Don't sync. Observed presence is named against Pinball Map — on Pinball Map, not on Pinball Map — so the two never read alike.
- **7.3** The fix-group names in §1 are the canonical names in copy and in discussion.

## 8. Permissions

- **8.1** Viewing requires signed-in membership (2.2).
- **8.2** Every action on the page carries the gate of the equivalent action elsewhere — `pinballmap.md` §8 for intent, matching, and pushes, and §3.7 for Confirm lineup. Seeing a row never grants its action.

---

## Known divergences (code vs spec)

| Spec              | Code today           | Resolution |
| :---------------- | :------------------- | :--------- |
| §2–§8 lineup page | Route does not exist | PP-o355.65 |

---

## Changelog

Changes to this document. Divergence-table rows are working state and are not logged here.

| Date | Change |
| :-- | :-- |
| 2026-09-27 | Created. The lineup page at `/m/pinball-map` (§2) with its header (§3), per-title comparison matrix (§4), fix groups (§5), in-sync and not-compared sections (§6), vocabulary (§7), and permissions (§8). |
