# Settings Sheets — Feature Spec

**Status: draft.**

**What this document is.** The requirements for printable settings sheets: the paper reference volunteers carry to change machines from their House settings to a tournament's settings before an event, and back afterward. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/machine-settings.md` (settings sets, settings tags, preferred sets — this document uses those concepts and does not redefine them), `docs/feature-specs/apron-cards.md` §12 (Print apron cards, the batch page this one follows), `docs/feature-specs/list-views.md` and `docs/feature-specs/machine-views.md` (the machine list), `docs/feature-specs/collections-and-tags.md` (Collections and machine tags). Bead PP-k3km.

---

## 1. Concepts

- **Settings sheet** — a printable document listing, for each machine in the print run, the changes between two of its settings sets.
- **Print run** — the machines a person has added to a sheet, each with the two sets it compares.
- **From set / To set** — the two sets a print run row compares. Each is chosen per machine; a new row takes them from the defaults.
- **Default sets** — the choice applied to each machine as it is added, one for each side: **preferred House**, **preferred Tournament** (machine-settings §4), or one **settings tag** (each machine's set carrying that tag, §6). The defaults are preferred House to preferred Tournament.
- **Direction** — which way a sheet is meant to be used: **set up** (From to To), **restore** (To back to From), or **both**.
- **Coverage** — what a sheet lists for each machine: **differences only**, or **full sets** (every setting in either set).
- **Difference** — one setting whose value is not the same in the two sets.

## 2. Print settings sheets page

- **2.1** Anyone, including anonymous visitors, can open a Print settings sheets page from the Machines list, where it sits beside Print apron cards (apron-cards §12.1).
- **2.2** The page's machine list is a Machine View Surface (list-views §1, machine-views §2.4): the same search, Primary Filters, List Header, rows, and pagination as the Machines list, with an Add action on each row. Its Page Preset filters to machines On the Floor.
- **2.3** Only machines On the Floor can be added. The list offers adding every machine its current filters show at once.
- **2.4** The default sets sit with the machine list, so they are chosen before machines are added. Changing a default updates every print run row whose sets the person has not changed by hand.
- **2.5** The print run lists each added machine with its From set and To set, both changeable to any of the machine's sets, what its block would print, and a way to remove it. A row whose default finds more than one set (§6.3) is marked and stays off the sheet until a set is chosen. A row whose default finds no set is marked and prints as §5 describes.
- **2.6** Each Collection's page and each machine tag's page links to this page with its machines On the Floor already added.
- **2.7** A Print run panel holds the direction, the coverage, the number of machines that will print, Preview, and Print. Set up and differences only are preselected. On a phone the panel's totals stay in view, as on Print apron cards.
- **2.8** Preview shows the sheet as it will print without opening the print dialog. Print opens the sheet on its own page without app navigation and opens the browser's print dialog; that page offers Print again and a way back to the print run.

## 3. Sheet layout

- **3.1** A sheet is printed from the browser on Letter paper.
- **3.2** A sheet fits as many machines on a page as stay readable, and never splits one machine's block across a page or column break.
- **3.3** The sheet's header names the default sets, the direction, the coverage, and the date it was printed.
- **3.4** Each machine's block names the machine, its initials, and its From and To sets, each with the date it was last edited.
- **3.5** Each printed setting shows its location in the machine's menu and its name, then the value for the chosen direction: the To set's value for set up, the From set's value for restore, and both side by side for both. Each value has a box to tick when it is done.
- **3.6** Machines are listed by name.
- **3.7** With differences only, a machine whose two sets have no differences takes no block; the sheet lists it in a single line of machines needing no change. A machine whose From and To sets are the same set is one of these. With full sets, every machine in the print run gets a block.
- **3.8** Every machine block ends with a Done line and two blank lines labeled Notes, for anything the person changing the machine wants to write down.
- **3.9** With full sets, a setting the two sets agree on is printed too, and each difference is bold. With differences only, nothing is bold.

## 4. Comparing two settings sets

- **4.1** Software settings and tables are compared row by row, matching rows by setting ID, or by name when a row has no ID. Tables are matched by title.
- **4.2** A row present in only one set is a difference. The other side's value reads as that set's install value, named by install, because PinPoint does not know it.
- **4.3** DIP switches are compared per bank and switch; with differences only, only switches whose position differs are printed.
- **4.4** Notes are compared as whole text. A note whose text differs is printed in full for the chosen direction; with full sets, matching notes print too.
- **4.5** When the two sets start from different installs, the block for each direction first says which install to apply, then lists every software row of the set being applied, because applying an install discards the rows of the set it replaces.

## 5. Machines a sheet cannot fully cover

- **5.1** A machine with a To set and no From set gets a block marked **no From set — record original values**. Each of the To set's rows has a blank to write the machine's value before changing it. The block ends with four blank rows, each with a location, setting, original value, and new value, for any other setting the person changes. Restore prints the same rows and blanks.
- **5.2** A machine with no To set gets a block marked **no To set** that holds only the four blank rows.
- **5.3** Apart from the spaces for writing in §5.1 and §5.2, a sheet never leaves a value empty where it is unknown; it names why the value is missing.

## 6. Printing by settings tag

- **6.1** Either default can be any settings tag (machine-settings §3).
- **6.2** For each machine, a tag default picks its preferred set for that side when that set carries the tag; otherwise the one set on the machine carrying the tag.
- **6.3** A machine with more than one set carrying the tag, none of them preferred, offers those sets in its print run row. Until the person chooses one, the machine is left off the sheet.

---

## Known divergences (code vs spec)

| Requirement | Divergence                | Resolution          |
| :---------- | :------------------------ | :------------------ |
| 1–6         | No settings sheet exists. | PP-k3km (sheets PR) |

## Changelog

| Date       | Change        |
| :--------- | :------------ |
| 2026-10-05 | Spec created. |
