# iScored Integration — Feature Spec

**Status: draft.**

**What this document is.** The requirements for PinPoint's iScored integration: what the system does and what users can do. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `docs/research/2026-09-15-iscored-api.md`, `docs/feature-specs/admin-integrations.md`, `docs/feature-specs/fleet.md`, `docs/ENV_VARS.md`.

---

## 1. Concepts

- **iScored game** — a game record hosted on iScored within the location's gameroom, identified by a game ID string and game title. Created in iScored's administrative console.
- **Machine link** — the association between a physical PinPoint machine and an iScored game ID. A machine is either linked or unlinked.
- **Score entry link** — the direct external URL (`https://www.iscored.info/?mode=public&user={user}&game={gameID}`) taking a player to iScored's mobile score submission screen for that game.
- **Gameroom** — the location's iScored account identity (e.g. `Apcscore`), configured through the server environment variable `ISCORED_USER`.

---

## 2. Machine linking & management

- **2.1** A machine may be linked to an iScored game by its game ID string (stored as text), or left unlinked.
- **2.2** Linking can be set or cleared by users with the machine-management capability on the machine's Manage tab.
- **2.3** Linking can be set or cleared via the `set_machine_iscored` MCP tool using machine initials or UUID.
- **2.4** Clearing a machine link removes the association in PinPoint immediately; no records on iScored are altered.

---

## 3. Reading from iScored & Privacy

- **3.1** PinPoint reads high scores using the gameroom-wide batch score endpoint (`https://www.iscored.info/api/{user}/getAllScores`) rather than per-game requests. Once upstream support for score filtering is available (e.g. `getAllScores?max=N`), PinPoint will adopt it to restrict payload size. Machine pages and fleet views read from this shared in-memory score cache. PinPoint never issues per-game requests in loops across machine collections.
- **3.2** PinPoint never submits or modifies scores on iScored; all score submission occurs externally on iScored via the score entry link.
- **3.3** Batch score fetching is throttled to a minimum interval of 15 seconds. Page requests serve stale cached scores immediately (non-blocking) while triggering an asynchronous background refresh if the cache is older than 15 seconds.
- **3.4** In compliance with CORE-SEC-007, PinPoint strips all player email addresses at the API client boundary; player emails are never stored, logged, or passed to UI components.
- **3.5** If `ISCORED_USER` is unset, or if iScored is unreachable or disabled, PinPoint degrades gracefully by rendering quiet empty/fallback states without failing page loads.

---

## 4. Machine Info tab ("Top Scores" card)

- **4.1** A Top Scores card renders on the machine's Info tab (`/m/[initials]`) in the main column below the hero.
- **4.2** For a linked machine with scores, the card displays the top three scores (rank, player name/initials, formatted score), an "Add score" button linking to the score entry page in a new tab, and a link to the machine's iScored tab.
- **4.3** For a linked machine with zero recorded scores, the card displays a quiet empty state ("No scores recorded yet") and an "Add score" button.
- **4.4** For an unlinked machine, the card displays a quiet empty state indicating no iScored link is configured.

---

## 5. Machine iScored tab

- **5.1** A dedicated "iScored" tab on the machine page (`/m/[initials]/iscored`) renders the machine's leaderboard, styled to echo iScored's presentation within PinPoint's native theme. In the machine tab strip, it is positioned immediately after the "Info" tab (between Info and Settings).
- **5.2** The tab strip renders the tab using the iScored brand label and logo.
- **5.3** For a linked machine, the tab lists all available high scores and includes an "Add score" button linking to the score entry page in a new tab.
- **5.4** For an unlinked machine, the tab displays a helpful empty state with a link to the location's public iScored gameroom URL (`https://www.iscored.info/{user}`) and instructions for linking the game in the Manage tab.

---

## 6. Fleet overview

- **6.1** The fleet dashboard (`/fleet`) displays each machine's iScored link status to identify unlinked machines across the collection.

---

## Known divergences (code vs spec)

| Spec | Code today | Resolution |
| :-- | :-- | :-- |
| §2.1–§2.2 machine linking in Manage tab | No form field in Manage tab | PP-h2bu.4 |
| §2.3 MCP linking tool | No `set_machine_iscored` MCP tool | PP-h2bu.6 |
| §4.1–§4.4 Info tab top scores card | Not yet rendered | PP-h2bu.4 |
| §5.1–§5.4 Machine iScored tab | Not yet rendered | PP-h2bu.4 |
| §6.1 Fleet overview column | Not yet rendered | PP-h2bu.5 |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-15 | Initial draft: machine linking, batch read with 15s non-blocking throttle & privacy contracts, Info tab top-3 card, machine iScored tab, MCP tooling, and fleet column. |
