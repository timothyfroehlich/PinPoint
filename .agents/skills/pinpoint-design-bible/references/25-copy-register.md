# Status & Error Copy Register (§25)

How status lines, error reasons, and state labels are written. Settled during
the PinballMap listing-control copy review (Tim, 2026-08-15/16).

## The register

Status and error copy uses the **telegraphic register**: a short bold label
(2–4 words), then at most one muted supporting line.

- **Drop articles and copulas** — "Sync off — differences not flagged",
  never "The sync is off, so differences aren't flagged".
- **Full prose sentences in a status line are wrong even when grammatical.**
  "No model has been set, so there is nothing to list…" was rejected for
  "No model set" + a supporting line.
- **Labels state facts.** Supporting lines earn their place or are omitted.
- **Neutral voice** — "the location's", not "our". Warmth is not the
  register's job.
- **Amber for incomplete configuration** (warning icon), not red — red stays
  reserved for destructive actions (§18's two-reds rule).

## Structure

| Tier            | What                                                 | Example                                           |
| :-------------- | :--------------------------------------------------- | :------------------------------------------------ |
| Label           | 2–4 words, bold, the fact                            | "No model set"                                    |
| Supporting line | One muted sentence, only if it adds                  | "Set a model to add this machine to Pinball Map." |
| Icon            | Carries tone, never meaning alone (§1 no-color-only) | amber triangle                                    |

## Scope

Applies to status lines, inline error reasons, disabled-control explanations,
empty states, and state labels. It does **not** apply to confirm-dialog
bodies, which carry consequences in full sentences ("Removes {game} from the
location's lineup on pinballmap.com. It will no longer be publicly
visible.") — a dialog is read once with attention; a status line is scanned
repeatedly.

Buttons stay imperative and specific per §12 conventions ("Add machine to
Pinball Map", not "Add" or "Submit").
