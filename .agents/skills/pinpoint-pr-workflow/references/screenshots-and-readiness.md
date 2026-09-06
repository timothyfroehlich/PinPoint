# Screenshots and readiness

## UI evidence

If a PR touches `src/app/**`, `src/components/**`, any `.css`, or design tokens, post
screenshots before calling it ready. The only exception is a genuine no-rendered-change
edit whose PR body contains `<!-- no-visual-change -->`.

Run the repository shooter with local Next.js and Supabase available:

```bash
node scripts/workflow/pr-screenshots.mjs <PR>
```

The script captures the configured pages at desktop and mobile sizes, pushes images to
the orphan `pr-screenshots` branch, and updates one SHA-tagged sticky PR comment. Re-run
it after every UI-affecting push.

For a subset, use only the equals form: `--pages=machine-edit`. A filtered run rebuilds
the sticky comment from that subset and drops other pages, so always finish with an
unfiltered run before handoff.

The first run, or an expired login state, regenerates `e2e/.auth/*.json` through the
Playwright `auth-setup` project. That resets and reseeds the worktree-local development
database, just as local E2E does.

The path-based screenshot gate cannot infer whether a UI-file refactor renders
differently. When it genuinely does not, place `<!-- no-visual-change -->` in the PR
body instead of posting meaningless identical screenshots. `merge-handoff.sh` recognizes
that marker; real screenshots take precedence.

## Apply `ready-for-review`

Apply the label only when all are true:

- current-head CI is green;
- exact-head Codex coverage or an honest Tim-run local attestation exists;
- every review thread is resolved;
- the PR has no merge conflict;
- required UI screenshots are current, or the body carries the valid no-visual-change
  marker.

Use GitHub's issue-update interface after reading existing labels, or:

```bash
gh pr edit <PR> --add-label ready-for-review
```

The label tells Tim the PR is ready for his merge decision. It neither authorizes a
merge nor obtains review. A label on a head that is unreviewed or newer than its review
merely defers the failure to merge time.

After applying it, read [merge handoff](merge-handoff.md).
