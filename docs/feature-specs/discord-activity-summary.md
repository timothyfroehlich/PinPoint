# Discord Activity Summary — Feature Spec

**Status: draft.**

**What this document is.** The requirements for the activity summary: a scheduled Discord post that lists what changed in PinPoint (issues, machines, and the Pinball Map lineup) over a configurable period. It describes the intended final state only; what the code does lives solely in the Known divergences table. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/feature-specs/discord.md` (the bot token and the Discord section), `docs/feature-specs/admin-integrations.md` (the page), `docs/feature-specs/pinballmap-region-alerts.md` (the channel-status rules reused here), `docs/feature-specs/pinballmap-lineup.md` (the rows to review), `docs/feature-specs/pinballmap-sync-report.md` (the retired weekly report this summary replaces). Bead PP-ogup, which records the approved message copy.

---

## 1. Concepts

- **Activity summary** — a Discord post listing the changes in one period.
- **Summary channel** — the Discord channel the activity summary posts to. It is separate from the region-alert channel.
- **Interval** — the length of one period: 1, 2, 4, 6, 12, or 24 hours, or **Disabled**, which turns the summary off.
- **Start time** — the hour of day, in US Central time, that anchors the schedule. Every post time is the start time plus a whole number of intervals.
- **Period** — the span of time one summary covers. It ends at the summary's post time.
- **Event type** — a kind of change the summary can report. Each event type is on or off.
- **Change** — one reported fact about one machine: an issue row, an availability change, or a row from an extra event type (§4.2). A machine-status change is not a change on its own, because it follows from the machine's issues.
- **Direction** — whether a machine's status got worse, got better, or stayed the same over the period, on the scale Operational, Needs Service, Unplayable.

## 2. Configuration (Discord section)

- **2.1** The Discord section of the Admin Integrations page hosts the activity summary settings: summary channel, interval, start time, and one on/off setting per event type.
- **2.2** Defaults: a 24-hour interval, a 6 PM start time, and the event types §4.1 lists.
- **2.3** The start time is chosen by the hour.
- **2.4** The summary posts when a summary channel is set, the interval is not Disabled, and Discord is configured (`discord.md` §2.2). To turn it off, set the interval to Disabled; the channel and other settings are kept.
- **2.5** The summary settings save on their own. Saving them never re-validates or changes the bot credentials, and saving the credentials never changes them.
- **2.6** Saving checks the summary channel against Discord, and **Send test message** posts a test line to it, under the same rules as the region-alert channel (`pinballmap-region-alerts.md` §2.3, §2.4).
- **2.7** The section shows the summary channel's status with the states and update rules of `pinballmap-region-alerts.md` §3, where **Not configured** means no summary channel is set, and **Posting** shows the last post time.

## 3. Schedule

- **3.1** Post times are the start time plus every multiple of the interval, in US Central wall-clock time, all year. Post times do not shift with daylight saving: a 6 PM start time posts at 6 PM Central every day of the year.
- **3.2** Each period starts where the previous period ended, so no change is reported twice or skipped, including across a daylight-saving change or a settings change.
- **3.3** When there is no previous period, or it ended before the previous scheduled post time, the period starts at the previous scheduled post time.
- **3.4** A post time that does not exist on the clock (the spring-forward hour) is skipped, and its changes go in the next period. A post time that occurs twice (the fall-back hour) posts once.
- **3.5** Each period posts at most once, even when the scheduler runs more than once.
- **3.6** A period with nothing to report posts nothing. It still counts as covered.
- **3.7** A failed post is not retried; the next period starts where the failed one ended. The failure shows in the channel status (§2.7).
- **3.8** A **Send summary now** action posts a summary immediately, covering one interval ending at that moment, using the saved settings. It is unavailable while the interval is Disabled or no summary channel is set.
- **3.9** When Send summary now has nothing to report, it posts a line saying so.
- **3.10** A successful Send summary now ends the current period: the next scheduled summary covers only what changed after it. A failed one changes nothing and shows in the channel status (§2.7).

## 4. Event types

- **4.1** On by default:
  - **Issues opened** — issues opened or reopened in the period.
  - **Issues closed** — issues closed in the period.
  - **Machine status** — machines whose status differs between the start and end of the period.
  - **Availability** — machines whose availability differs between the start and end of the period.
  - **New machines** — machines added in the period.
  - **Pinball Map sync** — what is out of sync between PinPoint and Pinball Map: the lineup page's rows to review (`pinballmap-lineup.md`).
- **4.2** Off by default:
  - **Issue progress** — open issues whose status moved between open stages, such as to Need Parts.
  - **Severity changes** — issues whose severity changed.
  - **Assignments** — issues whose assignee changed.
  - **Comment counts** — the number of comments added to each issue.
  - **Pinball Map comments** — Pinball Map comments on PinPoint's machines.
  - **Owner changes** — machines whose owner changed.
  - **New members** — people who joined PinPoint in the period.

## 5. What a period reports

- **5.1** The summary reports the net change across the period: a fact that changed and changed back within the period is not reported. The Pinball Map section is the exception; it reports current state (§5.5).
- **5.2** Issue rows:
  - **Opened** — opened in the period and open at its end. Shows the issue's severity.
  - **Closed** — open at the start of the period and closed at its end. Shows the resolution.
  - **Opened and closed** — opened and closed within the period, as one row. Shows the resolution. It appears when either Issues opened or Issues closed is on.
  - **Reopened** — closed at the start of the period and open at its end. Shows the issue's severity.
- **5.3** Machine status is inferred from open issues, as everywhere else in PinPoint, and compared at the start and end of the period.
- **5.4** A machine added in the period gets a New machines row showing its current availability, and no availability row. Its status is compared against Operational.
- **5.5** The Pinball Map section reports the lineup page's rows to review at the post time: the total to review, then each lineup section that has rows, in the lineup page's order (`pinballmap-lineup.md` §5.1), with its count. When nothing needs review, it says so.
- **5.6** Out of sync names its titles grouped by tag: To add, To remove, To update. In PinPoint, not linked names its machines. On Pinball Map, not linked names its entries' titles. Availability conflict names each machine's title with its tag (Alert or Note) and its availability. Section names and tags are the lineup page's (`pinballmap-lineup.md` §7.3).
- **5.7** Each Pinball Map list names at most ten items and states how many more there are.
- **5.8** When the most recent Pinball Map refresh failed, the section says so and states the date of the lineup it uses.
- **5.9** While Pinball Map is Waiting (`pinballmap.md` §3.5), the section states the lineup has not loaded yet.
- **5.10** The section links to the lineup page and carries Pinball Map attribution with a link to the tracked location's page (`pinballmap.md` §9.1).
- **5.11** The Pinball Map section causes a post only when the rows to review changed during the period: a row was added or resolved. Unchanged rows to review appear only when the summary posts for another reason. While Pinball Map is not configured, the section never appears.
- **5.12** The summary reads only stored data. Producing it never calls Pinball Map (`pinballmap.md` §3.4).

## 6. Layout

- **6.1** The summary begins with a heading that names the period in Central time and counts the issues opened, the issues closed, and the machines added.
- **6.2** Machines appear in three sections, in this order: **Needs attention** (status got worse), **Back in service** (status got better), and **Other changes** (status unchanged).
- **6.3** After those come New machines, Pinball Map, and New members.
- **6.4** A section with no rows is omitted.
- **6.5** A machine with two or more changes is a block: the machine's name with its status and availability changes, then one row per issue or extra event under it.
- **6.6** A machine with one change is a single line in its section: the machine's name, any status change, and that change.
- **6.7** Within a section, blocks come before single lines, and each group is ordered by machine name.
- **6.8** The Needs attention and Back in service headings carry a red and a green marker. Every other section heading carries a marker with no color meaning, so red and green only ever mean status direction.
- **6.9** Machine names link to the machine, and issue IDs link to the issue. Link previews are suppressed.
- **6.10** The summary never mentions or pings anyone. It names people only in Assignments, Owner changes, and New members rows, by name and never by email (CORE-SEC-007).
- **6.11** Issue titles, machine names, and Pinball Map titles cannot inject mentions or formatting.

## 7. Length

- **7.1** Each message stays within Discord's message length limit.
- **7.2** A summary that does not fit in one message continues in further messages, split between sections, or between machines within a section. A machine's block is never split.
- **7.3** Only the first message carries the heading (§6.1).
- **7.4** A machine block lists at most ten rows and states how many more there are.
- **7.5** A summary posts at most two messages. When it would need more, the last message states how many machines were left out and links to PinPoint.

## 8. Permissions

- **8.1** Configuring the activity summary requires the manage-integrations capability (`admin-integrations.md` §7).

---

## Known divergences (code vs spec)

| Spec | Code today | Resolution |
| :-- | :-- | :-- |
| §2.6 | Saving checks the summary channel only when it changed; an unchanged channel keeps its stored status until Send test message or a post updates it | PP-ogup |
| §3, §4–§7 | Settings save and show (§2, §8), but nothing posts: no scheduler, and Send summary now (§3.8) reports it is not available yet | PP-ogup |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-10-03 | Created. Configuration in the Discord section (§2), interval and Central start-time schedule with Send summary now (§3), event types and defaults (§4), net-change reporting and the Pinball Map rows to review, replacing the weekly sync report (§5), direction-sorted layout (§6), message splitting up to two messages (§7), permissions (§8). |
