# Machine Settings — Feature Spec

**Status: approved.**

**What this document is.** The requirements for machine settings sets: who can create, see, and edit them, how they are tagged, and how each machine's default sets are chosen. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/collections-and-tags.md` (machine tags), `docs/superpowers/specs/2026-07-22-shareable-settings-sets-design.md` (earlier owner/community design). Beads PP-k3km (settings sheets), PP-7gm5, PP-tn6t.

---

## 1. Concepts

- **Settings set** — one named, recorded configuration of a machine: a starting install plus the rows, DIP switches, tables, and notes that differ from it. A machine keeps zero or more.
- **Personal set** — a settings set only its author can edit.
- **Community set** — a settings set that technicians, the machine owner, and admins can edit.
- **Settings tag** — a public, system-wide label on settings sets, such as "Bat City 2025". **House** and **Tournament** are built-in settings tags that always exist. Settings tags are separate from machine tags.
- **Default House set / Default Tournament set** — the one set per machine chosen for each built-in tag. Other sets stay in use: any set can be printed (settings-sheets §2.5).

## 2. Kinds and visibility

- **2.1** Technicians, the machine owner, and admins can create settings sets on a machine. A new set is a personal set tagged House.
- **2.2** A personal set can be edited only by its author, and deleted by its author or an admin.
- **2.3** A community set can be edited and deleted by technicians, the machine owner, and admins.
- **2.4** A personal set's author can make it a community set. A community set stays a community set.
- **2.5** Every set is visible to everyone who can open the machine. The Settings tab hides other people's personal sets by default, unless they are a default set, and offers a filter to show them.

## 3. Settings tags

- **3.1** Settings tags are public and system-wide: any settings tag can be applied to any set on any machine, and anyone, including anonymous visitors, can open a tag's page.
- **3.2** House and Tournament always exist and cannot be renamed or deleted.
- **3.3** A technician or admin can create, rename, and delete other settings tags. A tag name is at most 20 characters and unique, ignoring capitalization and extra whitespace. Deleting a tag removes it from every set, asks for confirmation, and cannot be undone.
- **3.4** Technicians and admins can apply and remove settings tags on any set, and a machine's owner can on sets on the machines they own. Tagging never changes a set's contents.
- **3.5** A set can carry any number of settings tags, including both House and Tournament.
- **3.6** A tag's page lists every set carrying it, grouped by machine, and links to the Print settings sheets page (settings-sheets §2.6).
- **3.7** A Settings tags page lists every settings tag with how many sets carry it, House and Tournament first. The Tags page and each machine's Settings tab link to it.

## 4. Default sets

- **4.1** A machine has at most one default House set and one default Tournament set. Either may be absent, and one set may be both.
- **4.2** Only a set tagged House can be the default House set, and only a set tagged Tournament can be the default Tournament set. A default set keeps that tag until it stops being the default. A default set is always a community set: making a personal set a default makes it a community set.
- **4.3** Technicians and admins can make any eligible set a default, or clear it, and a machine's owner can on the machines they own. Choosing a new default set replaces the previous one.
- **4.4** A set created on a machine that has no default House set becomes its default House set.
- **4.5** Deleting a default set leaves that slot empty. Duplicating a set never copies default status; the copy is a personal set of the person who duplicated it, with the same tags.
- **4.6** Setting, replacing, or clearing a default set, including by 4.4 or by deleting it, notifies the machine owner and the machine's watchers, except the person who made the change.
- **4.7** The Settings tab marks both default sets so they can be found at a glance.

## 5. Timeline

- **5.1** Every change to a settings set records a timeline event on the machine: creating, editing, deleting, tagging, making it a community set, and setting, replacing, or clearing it as a default set.
- **5.2** The machine's timeline shows creating, deleting, and default-set events by default. The other settings events are hidden by default and can be shown with the timeline's filters.
- **5.3** Editing or tagging a set notifies no one.

---

## Known divergences (code vs spec)

| Requirement | Divergence | Resolution |
| :-- | :-- | :-- |
| 3.1, 3.3, 3.4, 3.6, 3.7 | Only the built-in House and Tournament tags exist; there are no custom settings tags or tag pages. | PP-k3km.2 |
| 4.6 | Changing a default set notifies no one. | PP-k3km.3 |

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-05 | Spec created. |
| 2026-10-07 | Preferred sets renamed default sets; added the Settings tags page (3.7) and the tag page's print link (3.6). |
