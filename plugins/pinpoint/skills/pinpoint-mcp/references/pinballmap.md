# Pinball Map linking

Pinball Map (pinballmap.com) is a public directory of where machines can be played. PinPoint records, for each machine, which Pinball Map title it is and whether it should be listed.

**No PinPoint tool writes to Pinball Map.** The tools change what PinPoint records. A person pushes the change to Pinball Map from the PinPoint web app.

## Finding the title

Pinball Map groups editions of one game (Pro, Premium, LE) into a family.

1. Call `search_pinballmap_catalog` with `query` set to the game's title.
2. For each result:
   - If `machineGroupId` is `null`, or `editionCount` is `1`, the result's `pinballmapMachineId` is the answer.
   - Otherwise call `search_pinballmap_catalog` with `machineGroupId` set to that family's id. Check that `familyName` in the answer is the game you meant: family ids and machine ids are different number series that overlap, so a wrong number can return a real but different game. Pick the edition's `pinballmapMachineId`.
3. If the edition is unclear (Pro or Premium?), ask the user. Do not pick one.

## Linking

Show a change preview, then call:

```text
update_machine(machine: "MM", pinballmapMachineId: 1234)
```

This is PERMANENT (SKILL.md §2):

- No tool can return the machine to "not linked" afterwards.
- If the machine was linked to a **different** title with intent `on`, intent goes back to `off`, and Insider Connected is cleared. Setting intent `on` again is a second call.
- If the machine was marked "not on Pinball Map", its hand-entered model details (manufacturer, year, designers, artists) are erased and the catalog's details replace them. No tool can re-enter them. Say this in the preview.

## Intent

```text
update_machine(machine: "MM", intent: "on")
```

- The machine must be linked first.
- `on` is refused when presence is `pending_arrival` or `removed`.
- `on` is PERMANENT: it can email owners and watchers about Pinball Map comments PinPoint has not imported before.
- `off` and `no_sync` are CHANGE.

After setting `on`, tell the user in these words: "PinPoint now wants <initials> listed on Pinball Map. It is not listed until someone pushes the update from the machine's page in the PinPoint web app." Do not say the machine is listed.

Several machines of the same title may all have intent `on`.

## Marking a machine as not on Pinball Map

For homebrew or custom machines Pinball Map does not list:

```text
update_machine(machine: "XX", pinballmapExcluded: true, pinballmapExcludedReason: "Custom homebrew cabinet")
```

- `pinballmapMachineId` and `pinballmapExcluded` cannot be sent together.
- `pinballmapExcluded` only accepts `true`. The only way back is linking the machine to a title.
- An excluded machine cannot have an intent.

## Insider Connected

Only when `get_machine` shows `pinballmap.insiderConnected.eligible: true`:

```text
update_machine(machine: "MM", insiderConnected: "on")
```

This records the wish in PinPoint only.
