# oxlint jsPlugins fixtures

Deliberately-violating source files for `src/test/lint/oxlint-fixtures.test.ts`,
which runs oxlint over this directory with the sibling `.oxlintrc.json` and
asserts each expected rule fires at the expected line.

**Why they live here and not under `src/test/`:** every lint script in the repo
(`lint`, `lint:_slim`, `lint:_oxlint`) runs over `src/ e2e/ scripts/`. A fixture
whose whole job is to violate a rule would fail those runs from inside `src/`.
This directory is outside all three paths, so the violations are only ever seen
by the fixture harness — which is the only thing that should see them.

`tsconfig.app.json` excludes the directory for the same reason: the fixtures are
lint inputs, not app source.

Fixtures are still Prettier-formatted (Prettier does run repo-wide), so keep
them formatted or the `format` gate goes red.
