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

**The directive fixtures are deliberately one concern per file.** A disable
directive changes what the rest of the file reports, so each isolates one thing:

| Fixture                    | Proves                                                                                                                                                              |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `restricted-disable.ts`    | the three CORE-TS-007 families are caught under every prefix and namespace. Every directive carries a description, so `require-directive-description` stays silent. |
| `governance-disable.ts`    | the three rules that _enforce_ the gate cannot be disabled. Each case was a verified bypass before it was closed.                                                   |
| `allowed-core-unsafe.ts`   | the three ESLint **core** `no-unsafe-*` rules stay disable-able. Must produce zero diagnostics.                                                                     |
| `undescribed-directive.ts` | descriptions are required. Only ever names `no-console`, so `no-restricted-disable-directives` stays silent.                                                        |
| `blanket-disable.ts`       | a blanket disable is caught — alone in its file, because a blanket disable suppresses everything after it.                                                          |

Line numbers in these files are asserted by the test, so adding a case means
updating the expected lines.
