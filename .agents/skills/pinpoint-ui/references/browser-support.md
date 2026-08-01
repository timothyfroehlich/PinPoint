# Browser Support & Modern Web Guidance

PinPoint targets **Baseline Widely available** (CORE-UI-005). The policy — what is in scope, what is deferred, what is adopted below the floor, and how to opt a Newly-available feature in — is owned by `pinpoint-design-bible` **§19**. The per-use-case guide map is owned by **§22**. This file is a pointer plus the two commands you actually run.

## Look the feature up; don't trust a cached date

**PinPoint does not maintain a local Baseline table.** A feature's Baseline tier and date must be derived live, from the `modern-web-guidance` catalog, at the moment you need it (CORE-UI-006). A hand-copied date is stale the day after it's written, and a stale date is worse than no date — it reads as authoritative.

```bash
npx -y modern-web-guidance@latest search "<query>"       # find guides by intent
npx -y modern-web-guidance@latest retrieve "<id>,<id2>"  # fetch full guide(s)
npx -y modern-web-guidance@latest list                   # browse the catalog
```

Each guide carries its own Baseline status. If a guide says **Widely available**, use the feature directly — no polyfill, no feature detection. If it says **Newly available**, either follow the guide's documented fallback or skip the recommendation; adopting it requires the per-feature opt-in in `pinpoint-design-bible` §19.

The plugin is installed from the Google Chrome marketplace at `~/.claude/plugins/marketplaces/googlechrome/skills/modern-web-guidance/`.
