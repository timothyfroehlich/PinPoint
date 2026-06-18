# Vendored external references — PinballMap

Verbatim copies of PinballMap's published API-conduct documents, plus a short
terms summary. These are the **source of truth** any agent or developer should
read before touching the PinballMap integration (`src/lib/pinballmap/`).

| File                      | What                                                                                   | Provenance                                                             |
| :------------------------ | :------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| `pinballmap-llms.txt`     | PBM's own API guidance for AI assistants — auth, rate limits, anti-patterns, endpoints | Fetched verbatim from `https://pinballmap.com/llms.txt` (2026-06-18)   |
| `pinballmap-robots.txt`   | PBM's robots policy — blocks AI crawlers from the site                                 | Fetched verbatim from `https://pinballmap.com/robots.txt` (2026-06-18) |
| `pinballmap-api-terms.md` | Our distilled conduct + attribution notes, with sources                                | Authored by us, cites llms.txt + FAQ                                   |

## Why these are vendored

1. **Compliance is a moving target.** The `llms.txt` drift-detection GitHub
   Action (epic bead I, `PP-o355.9`) diffs the live file against
   `pinballmap-llms.txt` here daily and opens a GitHub issue on change — so this
   copy must stay **byte-identical** to what PBM serves. Do not edit it by hand;
   refresh it from source.
2. **The API is the sanctioned channel; the website is not.** `robots.txt`
   blocks `ClaudeBot`/`anthropic-ai`/etc. from crawling pinballmap.com. Always
   use the documented JSON API (per `llms.txt`), never scrape the site.

See `docs/NON_NEGOTIABLES.md` (CORE-PBM-001) and the integration spec
`docs/superpowers/specs/2026-06-18-pinballmap-integration-design.md`.
