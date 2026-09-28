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
- **Unmatched entry** — a lineup entry no PinPoint machine is matched to.
- **Section** — one of the four lists that hold everything needing review: **Out of sync**, **In PinPoint, not linked**, **On Pinball Map, not linked**, and **Availability conflict**. Every title, entry, or machine that needs review appears in exactly one section.
- **In scope** — the page compares machines not marked Removed. A Removed machine appears only where it still affects the lineup (5.2, 5.5).

## 2. The page and access

- **2.1** The lineup page lives at `/m/pinball-map`, under the machines list. The machines list and the admin menu link to it.
- **2.2** Viewing the page requires signed-in membership, the same tier that reads the listing control (`pinballmap.md` §8.3). Anonymous visitors and guests do not reach it.
- **2.3** The page renders only from stored data. Opening it never calls Pinball Map (`pinballmap.md` §3.4).
- **2.4** While the integration is **Not configured**, the page states that and shows no comparison, header refresh, or retained snapshot as current (`pinballmap.md` §10.6).
- **2.5** While the integration is **Waiting** (`pinballmap.md` §3.5), the page shows the header with its Refresh and error marker, and no comparison.
- **2.6** The page is laid out for desktop widths. On a narrower screen it keeps the desktop layout inside a horizontally scrolling area rather than rearranging.

## 3. Header

- **3.1** The header names the tracked location, linked to its Pinball Map page (the attribution link-back, `pinballmap.md` §9.1).
- **3.2** The header shows the number of entries on the lineup and when PinPoint last refreshed it, with the shared, throttled Refresh (`pinballmap.md` §3.2).
- **3.3** The header shows the date Pinball Map last recorded an update to the location.
- **3.4** The header hosts **Confirm lineup on Pinball Map** under the rules of `pinballmap.md` §3.7.
- **3.5** When the most recent refresh attempts have failed, the header says so and states the age of the lineup the page is showing.

## 4. Summary

- **4.1** The page states how many rows need review across all sections, the count in each section that has any, and that it compares machines not marked Removed. The machines list's link to the page shows the same count.
- **4.2** When no section has rows, the page says PinPoint and Pinball Map agree, with the number of titles in sync.

## 5. Sections

- **5.1** Sections render in a fixed order — Out of sync, In PinPoint, not linked, On Pinball Map, not linked, Availability conflict — each with its count and a one-line statement of what it holds. A section with no rows is not shown.
- **5.2** **Out of sync** holds each matched title whose title intent — counting only cabinets not in Availability conflict — is On or Off while Pinball Map disagrees. Each row is tagged with its fix: **To add** (title intent On, not on Pinball Map), **To remove** (title intent Off, on Pinball Map — including a title whose only cabinets are Removed), or **To update** (on Pinball Map with title intent On, Insider Connected target differs, `pinballmap.md` §3.8). Each row offers the one push its tag names.
- **5.3** **In PinPoint, not linked** holds each machine not marked Removed that has no catalog match, is not uncataloged, and is not set to Don't sync. Every row offers the same action: edit the machine, where its title can be matched or the machine marked uncataloged.
- **5.4** **On Pinball Map, not linked** holds each unmatched entry. Every row offers the same actions: match the entry to a PinPoint machine, create a machine in PinPoint for it, or remove the entry from Pinball Map. When PinPoint machines share the entry's title family (`pinballmap.md` §1, Edition near-miss), the row names them as possible matches. Naming them never matches anything (`pinballmap.md` §2.2).
- **5.5** **Availability conflict** holds each machine set On the lineup that is not on the floor, one row per machine. Each row is tagged **Alert** when the machine is Removed or Pending Arrival (`pinballmap.md` §6.2) or **Note** when it is On Loan or Off the Floor (§6.5). Every row offers the same action: edit the machine.
- **5.6** Each row names the title, the PinPoint cabinets involved with their listing intent and availability, and — when the title is on Pinball Map — the entry's comment count.
- **5.7** The page itself performs only Pinball Map pushes and matching an entry to a machine; every other change happens on the machine's page. Outbound actions follow the listing control's rules exactly: the same capability and linked-account gates (`pinballmap.md` §8.2), the same confirmations (§4.5, §4.6), and the same no-credential guidance with a link to the location's Pinball Map page (§4.4). Matching follows `pinballmap.md` §2 and §8.1.
- **5.8** The page offers no action that acts on several rows at once. Every outbound write is one explicit, confirmed action on one entry (`pinballmap.md` §3.3).

## 6. In sync and not compared

- **6.1** Titles in sync are collapsed to one count, split into on-Pinball-Map and not-on-Pinball-Map, and can be expanded to list them.
- **6.2** A footer counts what the page does not compare: uncataloged machines, titles set to Don't sync, and Removed machines.
- **6.3** When no PinPoint cabinet carries an Insider Connected intent for an eligible title, the page compares nothing for that title's Insider Connected setting and states Pinball Map's values in the footer instead (`pinballmap.md` §3.8).

## 7. Vocabulary

- **7.1** `pinballmap.md` §4.8 applies: "listing" never appears; the object is an entry and the set is the lineup.
- **7.2** Intent is named with the listing control's own words — On the lineup, Off the lineup, Don't sync. Observed presence is named against Pinball Map — on Pinball Map, not on Pinball Map — so the two never read alike.
- **7.3** The section names and row tags (To add, To remove, To update, Alert, Note) are the canonical names in copy and in discussion.

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
| 2026-09-27 | Created. The lineup page at `/m/pinball-map` (§2), desktop-only (§2.6), with its header and refresh-failure notice (§3), summary count and nothing-to-review state (§4), four sections — Out of sync, In PinPoint, not linked, On Pinball Map, not linked, Availability conflict (§5) — in-sync and not-compared sections (§6), vocabulary (§7), and permissions (§8). |
