"""Tests for scripts/check_e2e_suite_coverage.py — the dead-e2e-spec gate.

The gate exists because a spec file that no Playwright suite config collects
still type-checks and still lints, so every signal stays green while the file
runs nowhere (PP-stut: e2e/profiles/profile-edit.spec.ts was dead that way for
about five weeks).

Two properties matter and both are covered here: the gate must go RED for a
spec no config collects, and it must fail LOUDLY rather than assume coverage
when a config's shape is something it cannot read.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from check_e2e_suite_coverage import (  # noqa: E402
    ConfigShapeError,
    SuiteConfig,
    collect_specs,
    find_repo_root,
    glob_to_regex,
    main,
    normalize_dir,
    parse_string_array,
    parse_string_literal,
    read_suite_config,
    strip_comments,
    top_level_entries,
)

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


def write_repo(root: Path, *, specs: list[str], configs: dict[str, str]) -> Path:
    """Materialise a minimal fake repo: a base config, suite configs, specs."""
    (root / "playwright.config.ts").write_text("export default {};\n", encoding="utf-8")
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


class TestTopLevelEntries:
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

    def test_absent_test_match_means_everything_under_test_dir(self, repo: Path):
        config = read_suite_config(repo, "playwright.config.smoke.ts")
        assert config.test_dir == "e2e/smoke"
        assert config.test_match is None

    def test_test_dir_inherited_only_via_spread_is_a_shape_error(self, repo: Path):
        (repo / "playwright.config.full.ts").write_text(
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


class TestCollects:
    def test_spec_outside_test_dir_is_not_collected(self):
        config = SuiteConfig("smoke", "e2e/smoke", None)
        assert config.collects("e2e/smoke/a.spec.ts")
        assert not config.collects("e2e/full/a.spec.ts")
        # Sibling directory sharing a name prefix must not match.
        assert not config.collects("e2e/smokeless/a.spec.ts")

    def test_empty_test_dir_imposes_no_directory_restriction(self):
        config = SuiteConfig("root", "", ["**/*.spec.ts"])
        assert config.collects("e2e/anywhere/a.spec.ts")

    def test_test_match_narrows_within_test_dir(self):
        config = SuiteConfig("full", "e2e", ["**/full/**/*.spec.ts"])
        assert config.collects("e2e/full/a.spec.ts")
        assert not config.collects("e2e/profiles/a.spec.ts")


class TestCollectSpecs:
    def test_enumerates_only_spec_files(self, repo: Path):
        assert collect_specs(repo) == [
            "e2e/full/dashboard.spec.ts",
            "e2e/full/nested/deep.spec.ts",
            "e2e/smoke/navigation.spec.ts",
        ]

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
        # main teaches everyone to ignore it.
        assert main([]) == 0
