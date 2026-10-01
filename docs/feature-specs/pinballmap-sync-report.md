# Pinball Map Sync Report — Feature Spec

**Status: draft.**

**What this document is.** The requirements for the weekly Pinball Map sync report: a Discord post that summarizes what the lineup page (`docs/feature-specs/pinballmap-lineup.md`) shows needs review. It describes the intended final state only; what the code does lives solely in the Known divergences table. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/pinballmap-lineup.md` (the comparison this report summarizes — its sections, tags, and counts are reused, never redefined), `docs/feature-specs/pinballmap.md` (the integration), `docs/feature-specs/pinballmap-region-alerts.md` (the other Pinball Map Discord post), `docs/feature-specs/discord.md` (the bot token), `docs/feature-specs/admin-integrations.md`. Bead PP-5qwx.

---

## 1. Concepts

Every concept in `pinballmap.md` §1 and `pinballmap-lineup.md` §1 applies unchanged.

- **Sync report** — a weekly Discord post summarizing the lineup page's rows to review.
- **Report channel** — the Discord channel the sync report posts to. It is separate from the region-alert channel.

## 2. Configuration (Pinball Map section)

- **2.1** The Pinball Map section of the Admin Integrations page has a **Sync report channel** field: the Discord channel id the report posts to.
- **2.2** No enable flag. The report posts when a report channel is set, the Discord bot token is present (`discord.md`), and Pinball Map is configured (`pinballmap.md` §10.5). To turn it off, clear the report channel.
- **2.3** Saving checks the report channel against Discord, and **Send test message** posts a test line to it, under the same rules as the region-alert channel (`pinballmap-region-alerts.md` §2.3, §2.4).
- **2.4** The section shows the report channel's status with the states and update rules of `pinballmap-region-alerts.md` §3, where **Not configured** means no report channel is set, and **Posting** shows the last report time.

## 3. Schedule

- **3.1** The report posts once a week, on Monday at 6 PM US Central time, all year — the local time does not shift with daylight saving.
- **3.2** The schedule is fixed. It is not admin-configurable, and there is no on-demand run; the test message (§2.3) is the only manual post.
- **3.3** The report posts at most once per week, even when the scheduler runs more than once.
- **3.4** A failed post is not retried; the next week's report posts as usual. The failure shows in the channel status (§2.4).

## 4. Content

- **4.1** The report reads only stored data — the same comparison the lineup page renders. Producing it never calls Pinball Map (`pinballmap.md` §3.4). Its counts always equal the lineup page's for the same stored data.
- **4.2** When rows need review, the report states the total to review, then each section that has rows, in the lineup page's order (`pinballmap-lineup.md` §5.1), with its count.
- **4.3** Out of sync names its titles grouped by tag — To add, To remove, To update. In PinPoint, not linked names its machines. On Pinball Map, not linked names its entries' titles. Availability conflict names each machine's title with its tag (Alert or Note) and its availability.
- **4.4** Each list names at most ten items and states how many more there are.
- **4.5** When nothing needs review, the report still posts, says so, and states the number of titles in sync (`pinballmap-lineup.md` §4.2).
- **4.6** When the most recent refresh failed, the report says so and states the date of the lineup it is using (`pinballmap-lineup.md` §3.5).
- **4.7** While Pinball Map is **Waiting** (`pinballmap.md` §3.5), the report states the lineup has not loaded yet. While **Not configured**, no report posts.
- **4.8** Every report links to the lineup page and carries Pinball Map attribution with a link to the tracked location's page (`pinballmap.md` §9.1). Link previews are suppressed.
- **4.9** The report omits the Insider Connected summary (`pinballmap-lineup.md` §6.3).
- **4.10** The report never mentions or pings anyone, and names no people — only titles and machines.
- **4.11** The report uses the lineup page's section names and tags (`pinballmap-lineup.md` §7.3).

## 5. Permissions

- **5.1** Configuring the report channel requires the manage-integrations capability (`admin-integrations.md` §7).

---

## Known divergences (code vs spec)

_None — the current implementation matches this spec._

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-30 | Created. Report channel configuration (§2), weekly Monday 6 PM Central schedule (§3), content drawn from the lineup comparison (§4), permissions (§5). |
