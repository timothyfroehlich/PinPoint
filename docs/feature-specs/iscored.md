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

- **4.1** A Top Scores card renders on the machine's Info tab (`/m/[initials]`) in the reference rail, directly below the Details card. On mobile it folds inline with the rail, after Details.
- **4.2** For a linked machine with scores, the card displays the top three scores as ranked rows (rank badge, player name, score date, formatted score), an "Add score" button linking to the score entry page in a new tab, and a "View all on iScored" link to the game's public iScored page in a new tab.
- **4.3** The card header carries the "Top scores" label and the iScored logo. For a linked machine the logo links to the game's public iScored page in a new tab; for an unlinked machine it renders as a plain image with no link. The logo renders in every card state so the card stays recognisable when empty or unlinked.
- **4.4** For a linked machine with zero recorded scores, the card displays a quiet empty state ("No scores recorded yet"), an "Add score" button, and the "View all on iScored" link.
- **4.5** For an unlinked machine, the card displays a quiet empty state indicating no iScored link is configured, with a link to the Manage tab for viewers who can open it. Guests see the sentence only.
- **4.6** Mockup: `docs/feature-specs/iscored-top-scores-mockup.html` (desktop and mobile Info tab, plus the four card states). Logo asset: `docs/feature-specs/iscored-logo.svg` (supplied by iScored; white background removed, viewBox cropped to the artwork).

---

## 5. Machine iScored tab

Removed 2026-09-16. The Info tab card's "View all on iScored" link replaces it: iScored's own game page already renders the full leaderboard with game art, and a PinPoint tab showing more rows of the same list added nothing members could not get one tap away. Revisit only if a tab would show something iScored's page does not (a signed-in member's own scores, score history, a per-machine reset). Section number retained so later citations stay stable.

---

## 6. Fleet overview

- **6.1** The fleet dashboard (`/fleet`) displays each machine's iScored link status to identify unlinked machines across the collection.

---

## Known divergences (code vs spec)

| Spec | Code today | Resolution |
| :-- | :-- | :-- |
| §2.3 MCP tool | Handled via consolidated `update_machine` tool | PP-u4ab.18 |
| §6.1 Fleet overview column | Not yet rendered | PP-h2bu.5 |

---

## Changelog

| Date | Change |
| :-- | :-- |
| 2026-09-17 | §4.3 clarified: the iScored logo is a link only when the machine is linked; unlinked it is a plain image (CodeRabbit finding on #2134). |
| 2026-09-16 | Design lock: Top Scores card moves to the rail under Details as top-three ranked rows with the iScored logo and an external "View all on iScored" link; §5 machine iScored tab removed; mockup added. Canvas: https://claude.ai/artifact/Rb7AXgxUVFwW8bEWFhhUgv |
| 2026-09-15 | Initial draft: machine linking, batch read with 15s non-blocking throttle & privacy contracts, Info tab top-3 card, machine iScored tab, MCP tooling, and fleet column. |
