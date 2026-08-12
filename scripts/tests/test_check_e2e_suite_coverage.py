"""Tests for scripts/check_e2e_suite_coverage.py — the dead-e2e-spec gate.

The gate exists because a spec file that no Playwright suite config collects
still type-checks and still lints, so every signal stays green while the file
runs nowhere (PP-stut: e2e/profiles/profile-edit.spec.ts was dead that way for
about five weeks).

One property matters above all and every test here serves it: **no config
shape may be read as wider coverage than it really has.** So the gate must go
RED for a spec no config collects, and it must fail LOUDLY rather than assume
coverage when a shape is unreadable. The three shapes that broke that promise
in review each have a named regression test below: testIgnore being parsed and
then dropped, an absent testMatch meaning "match everything", and a spread
being skipped so a base-config testMatch never reached the suite that spreads
it.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from check_e2e_suite_coverage import (  # noqa: E402
    DEFAULT_TEST_MATCH,
    ConfigShapeError,
    SuiteConfig,
    collect_specs,
    find_repo_root,
    glob_to_regex,
    main,
    normalize_dir,
    parse_default_imports,
    parse_string_array,
    parse_string_literal,
    read_suite_config,
    resolve_config_entries,
    resolve_module_path,
    strip_comments,
    top_level_entries,
    top_level_items,
)

BASE_CONFIG = """\
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
});
"""

FULL_CONFIG = """\
import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testDir: "./e2e",
  testMatch: "**/full/**/*.spec.ts",
  fullyParallel: false,
  workers: 3,
});
"""

SMOKE_CONFIG = """\
import { defineConfig, devices } from "@playwright/test";
import baseConfig from "./playwright.config";

const CROSS_BROWSER_SUBSET = ["**/navigation.spec.ts"];
const isCI = !!process.env["CI"];

export default defineConfig({
  ...baseConfig,
  testDir: "./e2e/smoke",
  fullyParallel: true,
  projects: [
    {
      name: "auth-setup",
      testDir: "./e2e",
      testMatch: "auth.setup.ts",
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      ...(!isCI && { testMatch: CROSS_BROWSER_SUBSET }),
    },
  ],
});
"""


def write_repo(
    root: Path,
    *,
    specs: list[str],
    configs: dict[str, str],
    base: str = BASE_CONFIG,
) -> Path:
    """Materialise a minimal fake repo: a base config, suite configs, specs."""
    (root / "playwright.config.ts").write_text(base, encoding="utf-8")
    for name, source in configs.items():
        (root / name).write_text(source, encoding="utf-8")
    for spec in specs:
        path = root / spec
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("// spec\n", encoding="utf-8")
    return root


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A fake repo mirroring PinPoint's real two-suite layout, all covered."""
    return write_repo(
        tmp_path,
        specs=[
            "e2e/full/dashboard.spec.ts",
            "e2e/full/nested/deep.spec.ts",
            "e2e/smoke/navigation.spec.ts",
            # Non-spec e2e modules must never be enumerated.
            "e2e/support/fixtures.ts",
            "e2e/auth.setup.ts",
        ],
        configs={
            "playwright.config.full.ts": FULL_CONFIG,
            "playwright.config.smoke.ts": SMOKE_CONFIG,
        },
    )


class TestGlobToRegex:
    def test_globstar_spans_zero_or_more_segments(self):
        regex = glob_to_regex("**/full/**/*.spec.ts")
        assert regex.match("e2e/full/dashboard.spec.ts")
        assert regex.match("e2e/full/nested/deep.spec.ts")
        assert regex.match("full/top.spec.ts")

    def test_globstar_pattern_rejects_other_directories(self):
        regex = glob_to_regex("**/full/**/*.spec.ts")
        assert not regex.match("e2e/smoke/navigation.spec.ts")
        assert not regex.match("e2e/fullish/x.spec.ts")

    def test_star_does_not_cross_a_path_separator(self):
        regex = glob_to_regex("**/*.spec.ts")
        assert regex.match("e2e/smoke/a.spec.ts")
        assert not glob_to_regex("e2e/*.spec.ts").match("e2e/smoke/a.spec.ts")

    def test_bare_pattern_gets_a_globstar_prefix(self):
        # Playwright prepends **/ to any pattern not already anchored.
        assert glob_to_regex("auth.setup.ts").match("e2e/auth.setup.ts")

    def test_question_mark_matches_one_non_separator_character(self):
        regex = glob_to_regex("**/a?.spec.ts")
        assert regex.match("e2e/ab.spec.ts")
        assert not regex.match("e2e/abc.spec.ts")

    def test_match_is_anchored_at_the_end(self):
        assert not glob_to_regex("**/*.spec.ts").match("e2e/a.spec.ts.bak")

    def test_bracket_expression(self):
        regex = glob_to_regex("**/*.[jt]s")
        assert regex.match("e2e/a.ts")
        assert regex.match("e2e/a.js")
        assert not regex.match("e2e/a.rs")

    def test_negated_bracket_expression(self):
        regex = glob_to_regex("**/*.[!t]s")
        assert regex.match("e2e/a.js")
        assert not regex.match("e2e/a.ts")

    def test_at_extglob_is_an_alternation(self):
        regex = glob_to_regex("**/*.@(spec|test).ts")
        assert regex.match("e2e/a.spec.ts")
        assert regex.match("e2e/a.test.ts")
        assert not regex.match("e2e/a.snap.ts")

    def test_question_extglob_is_optional(self):
        regex = glob_to_regex("**/a.?(c|m)ts")
        assert regex.match("e2e/a.ts")
        assert regex.match("e2e/a.cts")
        assert regex.match("e2e/a.mts")
        assert not regex.match("e2e/a.xts")

    def test_playwright_default_pattern_collects_both_spec_and_test(self):
        regex = glob_to_regex(DEFAULT_TEST_MATCH)
        for path in (
            "e2e/smoke/navigation.spec.ts",
            "e2e/smoke/navigation.test.ts",
            "e2e/smoke/navigation.spec.tsx",
            "e2e/smoke/navigation.spec.mjs",
        ):
            assert regex.match(path), path

    def test_playwright_default_pattern_rejects_a_support_module(self):
        regex = glob_to_regex(DEFAULT_TEST_MATCH)
        assert not regex.match("e2e/support/fixtures.ts")
        assert not regex.match("e2e/auth.setup.ts")

    def test_negated_extglob_raises_rather_than_guessing(self):
        with pytest.raises(ConfigShapeError, match="negated extglob"):
            glob_to_regex("**/!(support)/*.spec.ts")

    def test_unbalanced_extglob_raises(self):
        with pytest.raises(ConfigShapeError, match="unbalanced extglob"):
            glob_to_regex("**/@(a|b.spec.ts")

    def test_unterminated_bracket_raises(self):
        with pytest.raises(ConfigShapeError, match="unterminated bracket"):
            glob_to_regex("**/*.[jt")


class TestStripComments:
    def test_removes_line_and_block_comments(self):
        assert strip_comments("a // gone\nb /* also gone */ c").split() == [
            "a",
            "b",
            "c",
        ]

    def test_leaves_a_double_slash_inside_a_string_alone(self):
        source = 'const url = "http://localhost:3000"; // trailing'
        assert '"http://localhost:3000"' in strip_comments(source)

    def test_unterminated_block_comment_is_a_shape_error(self):
        with pytest.raises(ConfigShapeError):
            strip_comments("/* never closed")


class TestTopLevelItems:
    def test_preserves_source_order_including_spreads(self):
        items = top_level_items(FULL_CONFIG)
        assert items[0] == ("spread", "baseConfig", "")
        assert items[1] == ("key", "testDir", '"./e2e"')

    def test_reads_top_level_keys_and_skips_spreads(self):
        entries = top_level_entries(FULL_CONFIG)
        assert entries["testDir"] == '"./e2e"'
        assert entries["testMatch"] == '"**/full/**/*.spec.ts"'
        assert entries["workers"] == "3"

    def test_ignores_keys_nested_inside_projects(self):
        entries = top_level_entries(SMOKE_CONFIG)
        assert entries["testDir"] == '"./e2e/smoke"'
        # auth-setup's project-level testDir/testMatch must not leak up.
        assert "testMatch" not in entries

    def test_braces_inside_strings_do_not_move_the_depth_counter(self):
        source = 'export default defineConfig({ testDir: "./e{2}e", workers: 1 });'
        assert top_level_entries(source)["testDir"] == '"./e{2}e"'

    def test_comments_are_skipped(self):
        source = (
            "export default defineConfig({\n"
            '  // testDir: "./decoy",\n'
            "  /* also { not } real */\n"
            '  testDir: "./e2e",\n'
            "});\n"
        )
        assert top_level_entries(source)["testDir"] == '"./e2e"'

    def test_missing_define_config_is_a_shape_error(self):
        with pytest.raises(ConfigShapeError):
            top_level_entries("export default { testDir: './e2e' };")


class TestSpreadResolution:
    def test_parses_default_imports(self):
        assert parse_default_imports(FULL_CONFIG) == {
            "baseConfig": "./playwright.config"
        }

    def test_resolves_an_extensionless_relative_specifier(self, repo: Path):
        resolved = resolve_module_path(
            repo, "playwright.config.full.ts", "./playwright.config"
        )
        assert resolved == "playwright.config.ts"

    def test_bare_package_specifier_raises(self, repo: Path):
        with pytest.raises(ConfigShapeError, match="not a relative module"):
            resolve_module_path(repo, "playwright.config.full.ts", "@playwright/test")

    def test_specifier_resolving_to_no_file_raises(self, repo: Path):
        with pytest.raises(ConfigShapeError, match="no file on disk"):
            resolve_module_path(repo, "playwright.config.full.ts", "./nope")

    def test_base_keys_are_merged_in(self, repo: Path):
        entries = resolve_config_entries(repo, "playwright.config.smoke.ts")
        # Inherited from the base config through `...baseConfig`.
        assert entries["globalSetup"] == '"./e2e/global-setup.ts"'

    def test_local_key_after_a_spread_wins(self, repo: Path):
        entries = resolve_config_entries(repo, "playwright.config.smoke.ts")
        assert entries["testDir"] == '"./e2e/smoke"'

    def test_spread_after_a_key_overrides_that_key(self, repo: Path):
        (repo / "playwright.config.full.ts").write_text(
            'import baseConfig from "./playwright.config";\n'
            'export default defineConfig({ testDir: "./decoy", ...baseConfig });\n',
            encoding="utf-8",
        )
        entries = resolve_config_entries(repo, "playwright.config.full.ts")
        assert entries["testDir"] == '"./e2e"'

    def test_unresolvable_spread_raises_rather_than_being_skipped(self, repo: Path):
        # A skipped spread silently widens coverage — the exact failure mode
        # this gate exists to prevent, so an unreadable one must be loud.
        (repo / "playwright.config.full.ts").write_text(
            'export default defineConfig({ ...(isCI ? a : b), testDir: "./e2e" });\n',
            encoding="utf-8",
        )
        with pytest.raises(ConfigShapeError, match="spread"):
            resolve_config_entries(repo, "playwright.config.full.ts")

    def test_circular_spread_raises(self, repo: Path):
        (repo / "playwright.config.ts").write_text(
            'import other from "./playwright.config.full";\n'
            "export default defineConfig({ ...other });\n",
            encoding="utf-8",
        )
        with pytest.raises(ConfigShapeError, match="circular"):
            resolve_config_entries(repo, "playwright.config.full.ts")


class TestValueParsing:
    def test_parses_both_quote_styles(self):
        assert parse_string_literal('"./e2e"') == "./e2e"
        assert parse_string_literal("'./e2e'") == "./e2e"

    def test_rejects_a_non_literal(self):
        assert parse_string_literal("SOME_CONSTANT") is None
        assert parse_string_literal('isCI ? "a" : "b"') is None

    def test_parses_an_array_of_literals(self):
        assert parse_string_array('["**/a.spec.ts", "**/b.spec.ts"]') == [
            "**/a.spec.ts",
            "**/b.spec.ts",
        ]

    def test_rejects_an_array_containing_a_non_literal(self):
        assert parse_string_array('["**/a.spec.ts", SUBSET]') is None

    def test_normalize_dir_strips_leading_dot_slash_and_trailing_slash(self):
        assert normalize_dir("./e2e/smoke/") == "e2e/smoke"
        assert normalize_dir("e2e") == "e2e"

    def test_normalize_dir_maps_the_repo_root_to_empty(self):
        # "" means "no directory restriction", not "a prefix nothing matches".
        assert normalize_dir(".") == ""
        assert normalize_dir("./") == ""


class TestReadSuiteConfig:
    def test_reads_test_dir_and_test_match(self, repo: Path):
        config = read_suite_config(repo, "playwright.config.full.ts")
        assert config.test_dir == "e2e"
        assert config.test_match == ["**/full/**/*.spec.ts"]
        assert config.test_ignore == []

    def test_absent_test_match_models_playwrights_default(self, repo: Path):
        config = read_suite_config(repo, "playwright.config.smoke.ts")
        assert config.test_dir == "e2e/smoke"
        assert config.test_match == [DEFAULT_TEST_MATCH]
        assert config.default_match is True

    def test_test_ignore_is_read(self, repo: Path):
        (repo / "playwright.config.full.ts").write_text(
            FULL_CONFIG.replace(
                'testMatch: "**/full/**/*.spec.ts",',
                'testMatch: "**/full/**/*.spec.ts",\n  testIgnore: ["**/nested/**"],',
            ),
            encoding="utf-8",
        )
        config = read_suite_config(repo, "playwright.config.full.ts")
        assert config.test_ignore == ["**/nested/**"]

    def test_test_dir_missing_everywhere_is_a_shape_error(self, repo: Path):
        (repo / "playwright.config.ts").write_text(
            "export default defineConfig({ fullyParallel: true });\n", encoding="utf-8"
        )
        (repo / "playwright.config.full.ts").write_text(
            'import baseConfig from "./playwright.config";\n'
            "export default defineConfig({ ...baseConfig, workers: 3 });\n",
            encoding="utf-8",
        )
        with pytest.raises(ConfigShapeError, match="testDir"):
            read_suite_config(repo, "playwright.config.full.ts")

    def test_non_literal_test_match_is_a_shape_error(self, repo: Path):
        (repo / "playwright.config.full.ts").write_text(
            'export default defineConfig({ testDir: "./e2e", '
            "testMatch: SOME_CONSTANT });\n",
            encoding="utf-8",
        )
        with pytest.raises(ConfigShapeError, match="testMatch"):
            read_suite_config(repo, "playwright.config.full.ts")

    def test_non_literal_test_ignore_is_a_shape_error(self, repo: Path):
        (repo / "playwright.config.full.ts").write_text(
            'export default defineConfig({ testDir: "./e2e", '
            "testIgnore: /nested/ });\n",
            encoding="utf-8",
        )
        with pytest.raises(ConfigShapeError, match="testIgnore"):
            read_suite_config(repo, "playwright.config.full.ts")


class TestCollects:
    def test_spec_outside_test_dir_is_not_collected(self):
        config = SuiteConfig("smoke", "e2e/smoke", [DEFAULT_TEST_MATCH], [])
        assert config.collects("e2e/smoke/a.spec.ts")
        assert not config.collects("e2e/full/a.spec.ts")
        # Sibling directory sharing a name prefix must not match.
        assert not config.collects("e2e/smokeless/a.spec.ts")

    def test_empty_test_dir_imposes_no_directory_restriction(self):
        config = SuiteConfig("root", "", ["**/*.spec.ts"], [])
        assert config.collects("e2e/anywhere/a.spec.ts")

    def test_test_match_narrows_within_test_dir(self):
        config = SuiteConfig("full", "e2e", ["**/full/**/*.spec.ts"], [])
        assert config.collects("e2e/full/a.spec.ts")
        assert not config.collects("e2e/profiles/a.spec.ts")

    def test_test_ignore_subtracts_from_test_match(self):
        config = SuiteConfig("full", "e2e", ["**/full/**/*.spec.ts"], ["**/nested/**"])
        assert config.collects("e2e/full/a.spec.ts")
        assert not config.collects("e2e/full/nested/a.spec.ts")


class TestCollectSpecs:
    def test_enumerates_only_spec_files(self, repo: Path):
        assert collect_specs(repo) == [
            "e2e/full/dashboard.spec.ts",
            "e2e/full/nested/deep.spec.ts",
            "e2e/smoke/navigation.spec.ts",
        ]

    def test_enumerates_dot_test_ts_too(self, repo: Path):
        # Vitest roots every project's include at src/**, so a *.test.ts under
        # e2e/ is run by nothing unless a Playwright suite collects it.
        (repo / "e2e" / "profiles").mkdir(parents=True)
        (repo / "e2e" / "profiles" / "orphan.test.ts").write_text(
            "//", encoding="utf-8"
        )
        assert "e2e/profiles/orphan.test.ts" in collect_specs(repo)

    def test_missing_e2e_directory_yields_nothing(self, tmp_path: Path):
        assert collect_specs(tmp_path) == []


class TestFindRepoRoot:
    def test_walks_up_to_the_base_config(self, repo: Path):
        nested = repo / "e2e" / "full"
        assert find_repo_root(nested) == repo


class TestMain:
    def test_passes_when_every_spec_is_collected(self, repo: Path):
        assert main(["--root", str(repo)]) == 0

    def test_fails_on_a_spec_no_config_collects(self, repo: Path, capsys):
        orphan = repo / "e2e" / "profiles" / "profile-edit.spec.ts"
        orphan.parent.mkdir(parents=True)
        orphan.write_text("// spec\n", encoding="utf-8")

        assert main(["--root", str(repo)]) == 1
        stderr = capsys.readouterr().err
        assert "e2e/profiles/profile-edit.spec.ts" in stderr
        # The message must name what was considered, not just what failed.
        assert "playwright.config.full.ts" in stderr
        assert "playwright.config.smoke.ts" in stderr

    def test_support_modules_never_trigger_a_failure(self, repo: Path):
        # e2e/support/fixtures.ts and e2e/auth.setup.ts exist in the fixture and
        # are collected by no suite config; neither is a spec, so neither counts.
        assert main(["--root", str(repo)]) == 0

    def test_regression_test_ignore_must_not_be_read_then_dropped(
        self, repo: Path, capsys
    ):
        """A parsed-then-discarded testIgnore silently widened coverage.

        It does not even reach the unknown-shape error path: the key is read,
        thrown away, and the spec it excludes is reported as covered while
        Playwright collects nothing. Exactly the PP-stut failure.
        """
        (repo / "playwright.config.full.ts").write_text(
            FULL_CONFIG.replace(
                'testMatch: "**/full/**/*.spec.ts",',
                'testMatch: "**/full/**/*.spec.ts",\n  testIgnore: "**/nested/**",',
            ),
            encoding="utf-8",
        )
        assert main(["--root", str(repo)]) == 1
        stderr = capsys.readouterr().err
        assert "e2e/full/nested/deep.spec.ts" in stderr
        assert "testIgnore=**/nested/**" in stderr

    def test_regression_test_ignore_on_a_default_match_config(self, repo: Path, capsys):
        # The smoke config sets no testMatch, so before the default pattern was
        # modelled its collects() returned True unconditionally — a testIgnore
        # there could never have taken effect.
        (repo / "playwright.config.smoke.ts").write_text(
            SMOKE_CONFIG.replace(
                'testDir: "./e2e/smoke",',
                'testDir: "./e2e/smoke",\n  testIgnore: "**/navigation.spec.ts",',
            ),
            encoding="utf-8",
        )
        assert main(["--root", str(repo)]) == 1
        assert "e2e/smoke/navigation.spec.ts" in capsys.readouterr().err

    def test_regression_base_config_test_match_reaches_the_suite_that_spreads_it(
        self, repo: Path, capsys
    ):
        """A skipped spread let a base-config testMatch go unseen.

        Both suite configs are `{...baseConfig, ...}`. With spreads skipped and
        an absent testMatch treated as match-everything, the moment the base
        config grew a testMatch the gate kept claiming all of e2e/ was covered.
        """
        (repo / "playwright.config.ts").write_text(
            BASE_CONFIG.replace(
                'testDir: "./e2e",',
                'testDir: "./e2e",\n  testMatch: "**/full/**/*.spec.ts",',
            ),
            encoding="utf-8",
        )
        assert main(["--root", str(repo)]) == 1
        stderr = capsys.readouterr().err
        # The smoke suite now inherits full's pattern and collects nothing.
        assert "e2e/smoke/navigation.spec.ts" in stderr

    def test_absent_test_match_still_collects_ordinary_specs(self, repo: Path):
        # The other half of the same fix: modelling Playwright's default must
        # not turn "no testMatch" into a hard failure on a config that is fine.
        config = read_suite_config(repo, "playwright.config.smoke.ts")
        assert config.collects("e2e/smoke/navigation.spec.ts")
        assert main(["--root", str(repo)]) == 0

    def test_missing_spec_root_exits_two_rather_than_passing_vacuously(
        self, tmp_path: Path, capsys
    ):
        root = write_repo(
            tmp_path,
            specs=[],
            configs={
                "playwright.config.full.ts": FULL_CONFIG,
                "playwright.config.smoke.ts": SMOKE_CONFIG,
            },
        )
        assert main(["--root", str(root)]) == 2
        assert "e2e/" in capsys.readouterr().err

    def test_missing_suite_config_exits_two(self, repo: Path, capsys):
        (repo / "playwright.config.smoke.ts").unlink()
        assert main(["--root", str(repo)]) == 2
        assert "playwright.config.smoke.ts" in capsys.readouterr().err

    def test_unreadable_config_shape_exits_three(self, repo: Path, capsys):
        (repo / "playwright.config.full.ts").write_text(
            'export default defineConfig({ testDir: "./e2e", '
            "testMatch: SOME_CONSTANT });\n",
            encoding="utf-8",
        )
        assert main(["--root", str(repo)]) == 3
        assert "testMatch" in capsys.readouterr().err

    def test_real_repo_is_clean(self):
        # The gate must pass on the tree it ships with — a gate that is red on
        # main teaches everyone to ignore it. This also proves the real
        # playwright.config.ts parses through the `...baseConfig` spread.
        assert main([]) == 0
