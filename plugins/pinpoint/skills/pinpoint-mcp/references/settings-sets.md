# Settings sets

A settings set is a named list of the changes that put one machine into a particular setup: a tournament setup, the owner's house rules, a revert to factory. A machine can have many. The Settings tab in the web app shows them; `list_settings_sets`, `create_settings_set` and `update_settings_set` read and write them. Parameters and classes are in [`tools.md`](tools.md).

## Sections

A set's body is an ordered list of sections. Each one is one of four kinds; the field descriptions in the tool schema give the exact fields.

| Kind       | Holds                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `software` | Menu adjustments, one row each: the menu code (`A1.26`, `#31`), its name, its value. `baseline` names the install they change from. |
| `dip`      | DIP switch positions for one bank: switch number, ON or OFF, and what the switch does.                                              |
| `table`    | Any other id / name / value list with its own heading (Jones plugs, transformer taps).                                              |
| `note`     | Plain text. `Rubbers` and `Post positions` are the standard headings; anything else is a custom note.                               |

## Turning source material into a set

Source material is usually prose: a spreadsheet cell, a Discord message, a manual page. One cell often mixes several kinds of content. Sort each sentence into one of these:

- **A menu adjustment with a value** ("Tournament Play (A1.26) YES", "Thor MB set to HARD") becomes a `software` row. Put the code in `id` when the source gives one, otherwise leave `id` empty. Keep the source's wording for the name and value. A preset the rows build on ("Competition install", "Follow Stern settings", "Factory") goes in `baseline`, not in a row.
- **A DIP switch list** ("Sw. #28: ON (enables Novelty)") becomes a `dip` section, one switch per entry, with the parenthetical as the note.
- **A physical adjustment** (rubbers, posts, gates, flipper angle, ear plug) becomes a `note`: rubber changes under `Rubbers`, post changes under `Post positions`, the rest under a custom title such as `Other`.
- **Steps for after the event** ("Turn IFPA mode back on", "DO NOT FACTORY RESET") go in a custom note titled `After the event`.
- **Uncertainty or open work** ("STILL WAITING ON input", "CHECK TO CONFIRM", "I think ROTK needs…") goes in the set's `description`, quoted, so a person sees it before trusting the set.
- **A repair problem** ("Need to fix the right sling", "will not start game") is not a setting. Leave it out of the set and list it for the user as a possible issue to file.
- **Event planning** (whether the game is used, readiness, speed, average game time, bank assignments) has no home in a set. Leave it out and tell the user it was skipped.

Never invent a value, a menu code or a switch number the source does not state. A sentence you cannot sort goes in the description verbatim.

## Before creating

1. Find the machine (`SKILL.md` §6), then call `list_settings_sets` on it. When a set already covers the same purpose, propose `update_settings_set` on it instead of a new set.
2. Show the change preview with every section and every row written out, in order, exactly as you will send them, followed by the skipped content and the possible issues. One set is one numbered change; a batch of machines is one change per machine, at most 10 per preview.
3. A new set is Tim's personal set, tagged House unless the user says it is a tournament setup (`tags: ["tournament"]`). On a machine with no preferred House set, a House-tagged set becomes the preferred House set and a community set; say so in the preview. When the user wants technicians to maintain the set, follow with `update_settings_set` `makeCommunity: true` and say that it can't be undone.

## Editing a set

`sections` in `update_settings_set` replaces the whole list. Start from the sections `list_settings_sets` just returned, change only what the user asked for, and send the full list back with every section's `id` and the set's `version` from that read. A note whose text you send back unchanged keeps the formatting it had in the web app; a note you rewrite becomes plain text.
