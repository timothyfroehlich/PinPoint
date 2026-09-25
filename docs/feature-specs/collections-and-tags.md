# Collections and Tags — Feature Spec

**Status: draft.**

**What this document is.** The requirements for grouping machines in PinPoint: hand-curated Collections, ownership-derived Owner Collections, and public Tags. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/machine-views.md` (the shared machine listing every group's Overview uses), `docs/feature-specs/pinballmap.md` (catalog matching and uncataloged machines, which determine the current manufacturer), epic PP-wqit.

---

## 1. Concepts

- **Machine Group** — any named set of machines PinPoint can show as one unit with Overview, Issues, and Timeline tabs. Collections, Owner Collections, and Tags are Machine Groups; each defines its own membership, visibility, and curation.
- **Collection** — a Machine Group a member creates and curates by hand. Membership is exactly the machines someone added. Private to its owner unless shared.
- **Owner Collection** — the Machine Group of every machine one person owns. Membership follows machine ownership; nobody curates it and it cannot be edited or shared.
- **Editor** — a signed-in account the owner has granted edit access to one Collection. Editor access belongs to the account, never to a link.
- **View Link** — a Collection's secret, revocable URL that grants read-only access to anyone holding it, signed in or not.
- **Tag** — a public Machine Group whose name describes something about its machines. Every tag belongs to exactly one tag type.
- **Tag Type** — the kind of attribute a tag describes and the rule that decides its membership. Manufacturer is the first tag type.
- **Current Manufacturer** — the one manufacturer PinPoint attributes to a machine, derived from stored metadata (§8.1). A machine without one belongs to no manufacturer tag.

---

## 2. Collections

- **2.1** A signed-in member, technician, or admin can create a Collection. Guests and anonymous visitors cannot.
- **2.2** A Collection has a required name of at most 120 characters. Names need not be unique, even for one owner.
- **2.3** A Collection's machines are exactly the ones added to it. Adding or removing a machine never changes the machine itself.
- **2.4** Renaming a Collection and changing its machines save together as one change; a failed save changes nothing.
- **2.5** A Collection can include machines in any presence state.
- **2.6** Only the owner can delete a Collection. Deleting it removes the Collection, its machine list, its Editors, and its View Link; the machines and their issues are unaffected. Deletion asks for confirmation and cannot be undone.

---

## 3. Collection Access and Sharing

- **3.1** A Collection is private by default. Its owner, its Editors, and admins can open it by its address; anyone else gets the same not-found response as a Collection that does not exist.
- **3.2** A Collection's address alone never grants access. A person whose access is revoked gets the not-found response on their next visit.
- **3.3** The owner can turn on a View Link. Anyone with the link, including anonymous visitors, can see the Collection's Overview, Issues, and Timeline, and nothing else.
- **3.4** Turning a View Link off revokes every copy of it immediately. Turning it back on restores the same link. A View Link has no expiry.
- **3.5** A View Link never leaks through the Referer header of pages reached from it.
- **3.6** A View Link grants read-only access. Viewers who arrive through one see edit, share, or delete controls only when they already hold that access themselves.
- **3.7** The owner can grant Editor access to named signed-in accounts and revoke it. Guests cannot be Editors, and the owner cannot grant access to themselves.
- **3.8** The owner and Editors can rename the Collection and change its machines. Only the owner can delete it, change its View Link, or manage Editors. Admins can view any Collection but cannot edit or manage one they do not own.
- **3.9** Collection surfaces identify people by name only, never by email address.

---

## 4. Machine Group Pages

- **4.1** Every Machine Group page has Overview, Issues, and Timeline tabs under one header.
- **4.2** The header shows the group's name, its machine count, and how many machines are operational, need service, or are unplayable, plus the open-issue count.
- **4.3** Overview is the shared Machine View (machine-views.md) scoped to the group's machines, using the Collections Page Preset.
- **4.4** The Issues tab shows only issues on the group's machines. Its filters can narrow that set but never widen it.
- **4.5** The Timeline tab shows one chronological feed across the group's machines, each entry labeled with its machine. Its filters can narrow that set but never widen it. The feed is read-only.
- **4.6** An empty Collection shows people who can edit it a way to add machines, and shows everyone else that the Collection has no machines yet.

---

## 5. My Collections

- **5.1** A signed-in person has a My Collections page listing Collections they own and Collections they are an Editor of, as separate groups ordered by name.
- **5.2** Each listed Collection shows its machine count. Collections shared with the person also show the owner's name and their Editor access.
- **5.3** When the person owns at least one machine, My Collections also links to their Owner Collection.
- **5.4** My Collections offers Collection creation and opens the new Collection once it is created.
- **5.5** My Collections requires sign-in.

---

## 6. Owner Collections

- **6.1** Every person who owns at least one machine has an Owner Collection named for them.
- **6.2** An Owner Collection is public: anyone, including anonymous visitors, can open it.
- **6.3** An Owner Collection has no edit, share, add-machine, or delete controls, and no action can change its membership except changing machine ownership.

---

## 7. Tags

- **7.1** Tags are public: anyone, including anonymous visitors, can open a tag's page.
- **7.2** A tag's page is a Machine Group page (§4) whose machines are exactly the tag's members under its tag type's rule, in every presence state by default.
- **7.3** A public tag browse lists every tag with at least one machine, grouped by tag type, and links to each tag's page.
- **7.4** A machine's page links to each tag the machine belongs to.
- **7.5** A tag's page and address stay the same while its membership changes.
- **7.6** Tag membership is computed from data PinPoint already stores. Showing a tag, a tag page, or the tag browse never calls an external service.

---

## 8. Manufacturer Tags

- **8.1** A machine linked to a Pinball Map catalog title takes its Current Manufacturer from that stored catalog title, falling back to the machine's own stored manufacturer only when the catalog title is unavailable. A machine explicitly declared uncataloged uses its hand-entered manufacturer. A machine that is neither has no Current Manufacturer.
- **8.2** Each distinct Current Manufacturer is one manufacturer tag, and a machine belongs to exactly the tag for its Current Manufacturer.
- **8.3** Manufacturer names that differ only in capitalization or extra whitespace are the same tag. Any other difference makes separate tags; “Stern” and “Stern Electronics” are two tags.
- **8.4** A missing or “Unknown” manufacturer produces no tag.
- **8.5** Wherever PinPoint displays a machine's manufacturer as part of a Machine Group or the machine's own page, it shows the Current Manufacturer, so the displayed name always matches the machine's manufacturer tag.
- **8.6** Nobody applies or removes a manufacturer tag by hand; changing a machine's catalog match or hand-entered manufacturer changes its tag.

---

## 9. Deferred Work

- **9.1** Tags people create and apply by hand, and who may curate them, are deferred.
- **9.2** Tag types whose tags are mutually exclusive on one machine, beyond manufacturer, are deferred.
- **9.3** Era tags are deferred.
- **9.4** Collection descriptions are deferred.
- **9.5** Saving a Collection reached through a View Link to My Collections is deferred.
- **9.6** A public directory of Collections is deferred.
- **9.7** Adding a machine to a Collection from the machine's own page is deferred.
- **9.8** Writing notes from a Machine Group's Timeline is deferred.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :-- | :-- | :-- |
| 6.2 | Owner Collections require sign-in. | PP-wqit.9 |
| 7.1–7.6, 8.1–8.6 | Tags are not built; the machine page shows a "Tags — Coming soon!" placeholder. | PP-wqit.6 |
| 8.5 | Machine View falls back to a machine's own stored manufacturer when a linked catalog title has none, and shows it for machines that are neither linked nor uncataloged; the machine Info page shows the stored manufacturer directly. | PP-wqit.6 |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-24 | Created from as-built Collections behavior, with Owner Collections made public and manufacturer tags as the first tag type. |
