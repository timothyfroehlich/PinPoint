# iScored API Integration Research & Architecture Reference

**Date:** 2026-09-15  
**Author:** Antigravity  
**Status:** Complete  
**Scope:** Technical investigation of the iScored API (`https://iscored.info/api/`), verified live against the Austin Pinball Collective (`Apcscore`) gameroom, with design recommendations for PinPoint integration and the Apron Card Generator.

---

## 1. Executive Summary

[iScored](https://www.iscored.info) is a web application for tracking arcade and pinball high scores. The creator (Pizzapants) has provided public API access and direct score-entry URL schemas. API access has been enabled for the APC gameroom (`https://www.iscored.info/Apcscore`).

Key findings:

1. **Public Read Access, Zero Auth Tokens:** Once "API Read Access" is toggled on in the iScored account's Options tab, the API is unauthenticated and completely public. No API keys, bearer tokens, or HMAC secrets are required for reads or score submissions.
2. **Rate Limits & Batching:** The API enforces an IP rate limit of ~30–50 requests/minute. The creator explicitly requests **not** iterating per-game across a 50+ machine lineup on each page load. Instead, we should fetch all gameroom games in a single call (`/api/{user}`) or all scores (`/api/{user}/getAllScores`) and cache or mirror the data on the server.
3. **Apron Card & QR Code URLs:** The direct public mobile score-entry screen for any machine follows the deterministic URL pattern:  
   `https://www.iscored.info/?mode=public&user={user}&game={gameID}`  
   Where `{user}` is `Apcscore` and `{gameID}` is the game's numeric ID in iScored (e.g. `104656` for Demolition Man).
4. **Game Assets (Logos & Backgrounds):** Custom game logos and background graphics configured in iScored are exposed as relative paths on the gameroom endpoint (e.g. `/community/images/games/game2900`). These can be resolved against `https://www.iscored.info` and served as PNG/JPEG assets on apron cards or machine pages.
5. **PII Warning (CORE-SEC-007):** Both `/getAllScores` and the single-game score endpoints include an `email` field when entered by players. In accordance with `CORE-SEC-007`, PinPoint must discard/strip all player emails at the boundary and never expose them in public or member UI.

---

## 2. Primary Source Documentation & Live Endpoints

Documentation sources:

- Official API Landing Page: `https://iscored.info/api/`
- Official API Specification Document: `https://www.iScored.info/api/iScoredAPI.docx` (Version 0.6a by Pizzapants)
- APC Gameroom Display: `https://www.iscored.info/Apcscore`

### 2.1 Endpoint Catalog

All endpoints use HTTP GET (except `submitScore` and event controls which use POST) against the base URL `https://www.iscored.info/api/`.

| Endpoint                                  | Method | Params / Query                        | Description                                                                                                                                         |
| :---------------------------------------- | :----: | :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/{user}`                             |  GET   | None                                  | Returns gameroom metadata and an array of all configured games with GameIDs, visual CSS styling, logo/background paths, tags, and visibility flags. |
| `/api/{user}/getAllScores`                |  GET   | None                                  | Returns a flat array of all high scores across all games in the gameroom. Does not currently support `max`.                                         |
| `/api/{user}/{gameNameOrId}`              |  GET   | `?max={N}`                            | Returns top scores for a single game. Accepts either the numeric `gameID` or URL-encoded `gameName`. `max` defaults to 10 (`max=0` returns all).    |
| `/api/{user}/{gameNameOrId}/submitScore`  |  POST  | `playerName`, `score` (body or query) | Submits a score. Player name max 25 chars. Score must be integer (or ms for time). Denied if player's existing score is higher.                     |
| `/?mode=public&user={user}&game={gameID}` |  GET   | Standard web URL                      | Public mobile score-entry page for players scanning a QR code at the machine.                                                                       |

---

## 3. Verified Payloads (Tested Live with APC)

### 3.1 Gameroom / Games List (`GET /api/Apcscore`)

Returns an array of 136 game definitions (as of 2026-09-15).

```json
[
  {
    "gameName": "Game of Thrones (half-height)",
    "gameID": "79212",
    "CSSInitials": "font-size: 20px; font-family: 'Marcellus SC';color: #f2d45c; text-shadow: 0px 0px 10px #997729...",
    "CSSScores": "font-size: 28px; font-family: 'Krupper'; color: #d6d3cd; margin-top: -12px...",
    "CSSBox": " border-color: #595858;border-width: 3px;box-shadow: 3px 3px 3px #282828; min-height: 80px; max-height: 80px; height: 80px;",
    "CSSTitle": "",
    "ScoreType": "",
    "SortAscending": "",
    "GameLogo": "/community/images/games/game2900",
    "GameLogoSettings": "",
    "GameBackground": "/community/images/backgrounds/gameBg2900",
    "GameBgSettings": "",
    "tags": ["Stern"],
    "Hidden": "",
    "Locked": "FALSE",
    "GameColor": "#000000"
  },
  {
    "gameName": "Demolition Man",
    "gameID": "104656",
    "CSSInitials": "",
    "CSSScores": "",
    "CSSBox": "",
    "CSSTitle": "",
    "ScoreType": "",
    "SortAscending": "",
    "GameLogo": "/community/images/games/game1826",
    "GameLogoSettings": "",
    "GameBackground": "/community/images/backgrounds/gameBg1826",
    "GameBgSettings": "",
    "tags": [],
    "Hidden": "",
    "Locked": "",
    "GameColor": "#000000"
  }
]
```

#### Field Notes:

- `gameID`: String containing a positive integer.
- `gameName`: String title. May include era or edition qualifiers (e.g. `Cheetah`, `Rush (LE) (Stern 2022)`, `Space Train (MAC 1987)`).
- `Hidden`: String (`"TRUE"` or empty `""`). Hidden games are not shown on the public scoreboard.
- `Locked`: String (`"TRUE"`, `"FALSE"`, or empty `""`). Locked games do not accept score submissions.
- `GameLogo` / `GameBackground`: Relative URL paths. Prepending `https://www.iscored.info` resolves directly to binary image files (PNG/JPEG) with standard caching headers.

### 3.2 Single Game High Scores (`GET /api/Apcscore/{gameNameOrId}?max=3`)

Testing verified that both `/api/Apcscore/79220` and `/api/Apcscore/Domino%20(Gottlieb%201968)` return identical results:

```json
{
  "gameName": "Domino (Gottlieb 1968)",
  "GameID": "79220",
  "scores": [
    {
      "name": "NAW",
      "game": 79220,
      "date": "2025-07-05 19:03:10",
      "email": "",
      "id": 195634,
      "rank": "1",
      "score": "4758"
    },
    {
      "name": "Meredeath",
      "game": 79220,
      "date": "2025-07-08 21:44:11",
      "email": "",
      "id": 196308,
      "rank": "2",
      "score": "4681"
    },
    {
      "name": "Mat",
      "game": 79220,
      "date": "2025-07-19 18:45:52",
      "email": "",
      "id": 199108,
      "rank": "3",
      "score": "4570"
    }
  ]
}
```

### 3.3 All Scores Batch (`GET /api/Apcscore/getAllScores`)

Returns an array of score entries across the whole gameroom:

```json
[
  {
    "name": "Evan S",
    "id": 340428,
    "game": 79615,
    "event": null,
    "gameName": "Slick Chick (Gottlieb 1963)",
    "date": "2026-08-09 15:55:04",
    "wins": 0,
    "losses": 0,
    "email": "evansstaggs@gmail.com",
    "score": 1076
  }
]
```

> [!CAUTION]
> **Email Privacy (CORE-SEC-007):** As shown above, player email addresses are visible in the API output if players entered them during score submission. In PinPoint, player emails must be stripped immediately upon ingest and never persisted or sent to the browser.

### 3.4 Error Responses & Edge Cases

The iScored API returns HTTP 200 even on errors, indicating status via text or payload structure:

1. **User Does Not Exist or API Disabled:**
   - Status: HTTP 200
   - Content-Type: `text/html; charset=UTF-8`
   - Body: `Sorry, this user does not have API access enabled.`
2. **Game Not Found in Valid Gameroom:**
   - Status: HTTP 200
   - Content-Type: `text/html; charset=UTF-8`
   - Body: `{"gameName" : "nonexistent_game_12345","GameID" : "-1","scores" : []}`
   - `GameID === "-1"` and `scores === []`.

---

## 4. Architectural Recommendations for PinPoint

### 4.1 Server Environment Variable

Following PinPoint's environment variable strategy (`docs/ENV_VARS.md`), iScored configuration starts with an optional server environment variable:

```bash
ISCORED_USER="Apcscore"
```

Optional companion (defaults to `https://www.iscored.info`):

```bash
ISCORED_BASE_URL="https://www.iscored.info"
```

- **Scope:** Production, Preview, Development.
- **Classification:** §4.2 (Production-relevant but not build-gated). If unset, iScored features degrade gracefully (cards omit iScored links/scores; admin UI marks it unconfigured). It does not fail the build.
- **Client exposure:** Never `NEXT_PUBLIC_`. If public pages or client components need the gameroom name or score-entry links, they should receive computed URLs from server loaders or a server action.

### 4.2 Admin Integrations Page Section

In `docs/feature-specs/admin-integrations.md`, section 1 defines:

> "Each integration owns exactly one section on the page."

When we build the UI section:

- Place it as a new `<Card data-testid="iscored-integration-card">` in `src/app/(app)/admin/integrations/page.tsx`.
- Allow viewing/updating the configured iScored user/gameroom name (with validation against `GET /api/{user}`).
- Show connection status (e.g. "Connected: 136 games found in gameroom 'Apcscore'").

### 4.3 Machine Linking Model

To connect a PinPoint machine to an iScored game:

- Add a nullable column on `machines`: `iscored_game_id text` (or integer).
- Provide a machine edit / link field or automatic name-matcher that suggests matches based on `gameName` similarity to PinPoint's `name` and `modelName`.
- Direct mobile score-entry link for a linked machine:  
  `https://www.iscored.info/?mode=public&user=${ISCORED_USER}&game=${machine.iscoredGameId}`

### 4.4 Data Fetching & Caching Strategy

Given the 30–50 req/min rate limit:

- **Do not query `/api/{user}/{game}` on every machine page view.**
- Recommended pattern:
  - Cache gameroom games list (`/api/{user}`) with a reasonable TTL (e.g. 1 hour via Next.js `fetch(..., { next: { revalidate: 3600 } })` or background cron).
  - Cache top scores per game with a short TTL (e.g. 5–15 minutes) or fetch on-demand during apron card generation.
  - Apron Card generation is an occasional print/export action, so fetching top 3–5 scores at generation time is well within rate limits.

---

## 5. Summary of Prerequisite Work for Apron Card Generator

1. **Bead & Tracking:** Create a Bead for the iScored integration foundation.
2. **Environment Variable:** Declare `ISCORED_USER` in `docs/ENV_VARS.md` and support it in a new module `src/lib/iscored/config.ts`.
3. **Client Seam:** Build `src/lib/iscored/client.ts` with typed methods:
   - `getGameroomGames(user?: string)`
   - `getGameScores(gameIdOrName: string, max?: number, user?: string)`
   - Stripping `email` fields to satisfy `CORE-SEC-007`.
4. **Machine Schema & Linking:** Add `iscoredGameId` to `machines` table to link PinPoint cabinets to iScored GameIDs.
5. **Apron Card Integration:** Apron card generator can consume `machine.iscoredGameId` to:
   - Render the iScored mobile score entry QR code.
   - Render top 3–5 high scores and player initials.
   - Optionally render the game's iScored logo or background.
