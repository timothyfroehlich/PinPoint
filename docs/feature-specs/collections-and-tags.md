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
- **Tag** — a public Machine Group whose name describes something about its machines. A tag belongs to at most one tag type. Every automatic tag belongs to one.
- **Tag Type** — the kind of attribute a tag describes and the rule that decides its membership. A tag type is either automatic (PinPoint derives membership from machine data) or hand-applied (people apply its tags to machines). Manufacturer is the first automatic tag type.
- **Exclusive Tag Type** — a tag type whose tags a machine can hold at most one of at a time. Every automatic tag type is exclusive.
- **Current Manufacturer** — the one manufacturer PinPoint attributes to a machine, derived from stored metadata (§8.1). A machine without one belongs to no manufacturer tag.

---

## 2. Collections

- **2.1** A signed-in member, technician, or admin can create a Collection. Guests and anonymous visitors cannot.
- **2.2** A Collection has a required name of at most 120 characters. Names need not be unique, even for one owner.
- **2.3** A Collection's machines are exactly the ones added to it. Adding or removing a machine never changes the machine itself.
- **2.4** Renaming a Collection and changing its machines save together as one change; a failed save changes nothing.
- **2.5** A Collection can include machines in any presence state.
- **2.6** Only the owner can delete a Collection. Deleting it removes the Collection, its machine list, its Editors, and its View Link; the machines and their issues are unaffected. Deletion asks for confirmation and cannot be undone.
- **2.7** The machine choice for adding to a Collection leaves out Removed machines, except ones already in the Collection.

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
- **4.2** The header shows the group's name, its machine count, and how many machines are operational, need service, or are unplayable, plus the open-issue count. None of these counts include Removed machines or their issues.
- **4.3** Overview is the shared Machine View (machine-views.md) scoped to the group's machines, using the Collections Page Preset.
- **4.4** The Issues tab shows only issues on the group's machines. Its filters can narrow that set but never widen it.
- **4.5** The Timeline tab shows one chronological feed across the group's machines, each entry labeled with its machine. Its filters can narrow that set but never widen it. The feed is read-only.
- **4.6** An empty Collection shows people who can edit it a way to add machines, and shows everyone else that the Collection has no machines yet.

---

## 5. My Collections

- **5.1** A signed-in person has a My Collections page listing Collections they own and Collections they are an Editor of, as separate groups ordered by name.
- **5.2** Each listed Collection shows its machine count, leaving out Removed machines. Collections shared with the person also show the owner's name and their Editor access.
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
- **7.2** A tag's page is a Machine Group page (§4) whose machines are exactly the tag's members. An automatic tag's members follow its tag type's rule; a hand-applied tag's members are the machines it was applied to (11.4).
- **7.3** A public tag browse lists every tag, grouped by tag type, and links to each tag's page. Hand-applied tags with no tag type form their own group. Automatic tags exist only while at least one machine belongs to them (§8, §9). A hand-applied tag is listed even when it has no machines.
- **7.4** A machine's page links to each tag the machine belongs to.
- **7.5** A tag's page and address stay the same while its membership changes.
- **7.6** Tag membership is computed from data PinPoint already stores. Showing a tag, a tag page, or the tag browse never calls an external service.
- **7.7** Each tag type has a public page listing its tags. A tag's page identifies it as a tag and links to its tag type's page when it has one. The tag browse links each tag type's section to that page.
- **7.8** A tag type whose membership PinPoint derives from machine data, rather than people assigning it, is marked automatic on its page and in the tag browse.
- **7.9** Machine counts shown for tags in the tag browse and on tag type pages leave out Removed machines.

---

## 8. Manufacturer Tags

- **8.1** A machine linked to a Pinball Map catalog title takes its Current Manufacturer from that stored catalog title, falling back to the machine's own stored manufacturer only when the catalog title is unavailable. A machine explicitly declared uncataloged uses its hand-entered manufacturer. A machine that is neither has no Current Manufacturer.
- **8.2** Each distinct Current Manufacturer is one manufacturer tag, and a machine belongs to exactly the tag for its Current Manufacturer.
- **8.3** Manufacturer names that differ only in capitalization or extra whitespace are the same tag. Any other difference makes separate tags; “Stern” and “Stern Electronics” are two tags.
- **8.4** A missing or “Unknown” manufacturer produces no tag.
- **8.5** Wherever PinPoint displays a machine's manufacturer as part of a Machine Group or the machine's own page, it shows the Current Manufacturer, so the displayed name always matches the machine's manufacturer tag.
- **8.6** Nobody applies or removes a manufacturer tag by hand; changing a machine's catalog match or hand-entered manufacturer changes its tag.

---

## 9. Type, Display, and Player Count Tags

- **9.1** Type, Display, and Player Count are automatic tag types. A machine linked to a Pinball Map catalog title takes its values from that title's Open Pinball Database (OPDB) record, read from a copy of OPDB's published data that PinPoint stores and refreshes on a schedule. A machine explicitly declared uncataloged uses its hand-entered type, display, and player count.
- **9.2** A machine that is neither linked nor uncataloged, or whose catalog title has no OPDB record, belongs to no Type, Display, or Player Count tag. A value left blank, in the OPDB record or by hand, produces no tag of that type.
- **9.3** The Type tags are Electromechanical, Solid State, and Pure Mechanical.
- **9.4** The Display tags are Reels, Lights, Alphanumeric, CGA, DMD, and LCD.
- **9.5** A Player Count tag names the machine's player count: “1 Player” for one player and “N Players” otherwise, such as “4 Players”.
- **9.6** A machine belongs to at most one tag of each of these types. Nobody applies or removes these tags by hand; changing a machine's catalog match or hand-entered values changes its tags.

---

## 10. Deferred Work

- **10.1** _Retired 2026-10-02._ Hand-applied tags are now §11. Number kept so older citations don't dangle.
- **10.2** _Retired 2026-10-02._ Exclusive hand-applied tag types are now §11.5–11.7. Number kept so older citations don't dangle.
- **10.3** Collection descriptions are deferred.
- **10.4** Saving a Collection reached through a View Link to My Collections is deferred.
- **10.5** A public directory of Collections is deferred.
- **10.6** Adding a machine to a Collection from the machine's own page is deferred.
- **10.7** Writing notes from a Machine Group's Timeline is deferred.
- **10.8** Merging one hand-applied tag into another is deferred.

---

## 11. Hand-Applied Tags

- **11.1** A technician or admin can create a hand-applied tag type, giving it a name and choosing whether it is exclusive.
- **11.2** A tag type name is at most 20 characters and unique across all tag types, automatic ones included. Names that differ only in capitalization or extra whitespace count as the same name.
- **11.3** A technician or admin can create a hand-applied tag, either in a hand-applied tag type or with no tag type. A tag name is at most 20 characters. It is unique within its tag type, or among tags with no tag type, under the same rule as 11.2. Nobody can add a tag to an automatic tag type.
- **11.4** A technician or admin can apply any hand-applied tag to any machine and remove it. A machine's owner can apply and remove hand-applied tags on the machines they own. No one else can. Applying or removing a tag never changes the machine itself.
- **11.5** In an exclusive tag type, applying a tag to a machine that already holds another tag of that type replaces the old tag.
- **11.6** A machine can hold any number of tags from a tag type that is not exclusive, and any number of tags that have no tag type.
- **11.7** A technician or admin can change whether a hand-applied tag type is exclusive. A tag type can be made exclusive only while no machine holds more than one of its tags. Making it non-exclusive is always allowed.
- **11.8** A technician or admin can rename a hand-applied tag type or tag. Links to its page keep working after a rename.
- **11.9** A technician or admin can delete a hand-applied tag or tag type. Deleting a tag removes it from every machine. Deleting a tag type deletes its tags. Deletion asks for confirmation and cannot be undone. The machines are otherwise unaffected.
- **11.10** A machine's page lets anyone who can tag that machine (11.4) apply and remove its hand-applied tags. They choose from every hand-applied tag, including tags with no machines.
- **11.11** A hand-applied tag's page lets technicians and admins add machines to the tag and remove machines from it, several at a time. Owners tag their machines from the machine's page (11.10).
- **11.12** The tag browse lets technicians and admins create tag types and tags. A hand-applied tag type's page lets them create tags in that type.
- **11.13** A hand-applied tag with no machines is listed after every tag in its group that has machines, wherever its group's tags are listed. Its page stays open to everyone and shows that it has no machines.
- **11.14** The tag browse and a machine's page list hand-applied tag types after the automatic ones, ordered by name, followed by tags with no tag type. Tags within each group are ordered by name, subject to 11.13.
- **11.15** A technician or admin can create a tag from a machine's page while tagging that machine. The tag has no tag type unless they choose one, and it is applied to that machine.
- **11.16** A technician or admin can move a hand-applied tag into a hand-applied tag type, from one tag type to another, or out of its tag type. A move is blocked if the tag's name is already taken where it is going, or if it would leave a machine holding two tags of an exclusive tag type.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :-- | :-- | :-- |
| 6.2 | Owner Collections require sign-in. | PP-wqit.9 |
| 11.4, 11.10, 11.15 | A machine's page lists its hand-applied tags but has no control to apply or remove them, so machine owners cannot tag their machines and nobody can create a tag while tagging a machine. | PP-wqit.3 |
| 11.7, 11.16 | A tag type's exclusivity is fixed when it is created, and a tag cannot move into, between, or out of tag types. | PP-wqit.3, PP-wqit.4 |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-03 | Removed machines are archived: left out of the add-machine choice (2.7), header counts (4.2), Collection counts (5.2), and tag counts (7.9); 7.2 drops its every-presence default, which machine-views §9.2 now sets. |
| 2026-10-02 | Added hand-applied tags, with or without a hand-applied tag type, curated by technicians and admins and applied by machine owners to their own machines. Tag types can be exclusive. Names are capped at 20 characters. The tag browse lists hand-applied tags with no machines. Retired deferred items 10.1–10.2 and deferred tag merging. |
| 2026-09-26 | Uncataloged machines join Type, Display, and Player Count tags through hand-entered values. |
| 2026-09-25 | Added Type, Display, and Player Count tag types from OPDB data; dropped deferred era tags. |
| 2026-09-25 | Added tag type pages and automatic tag type marking. |
| 2026-09-24 | Created from as-built Collections behavior, with Owner Collections made public and manufacturer tags as the first tag type. |
