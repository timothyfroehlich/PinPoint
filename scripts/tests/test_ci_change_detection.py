"""Tests for CI change detection rules in .github/workflows/ci.yml.

Verifies that PRs touching only developer tooling — Python/shell scripts, Python
tests, agent configs, linters, data files (.sql/.json/.txt) under scripts/, or
non-PR workflows — bypass expensive E2E, Supabase integration, and build suites,
while real website changes, CI changes, TypeScript unit tests, TS/JS scripts, and
package.json continue to run the required CI suites (PP-9jar).
"""

import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).parent.parent.parent
CI_YML_PATH = REPO_ROOT / ".github" / "workflows" / "ci.yml"


@lru_cache(maxsize=None)
def _glob_to_regex(glob: str) -> re.Pattern[str]:
    """Translate a dorny/paths-filter (picomatch) glob to an anchored regex.

    Mirrors the picomatch semantics dorny/paths-filter@v4 runs with `dot: true`,
    which Python's ``fnmatch`` does NOT model: ``*`` matches within a single path
    segment (it does not cross ``/``), while ``**`` is a globstar that spans zero
    or more whole segments. Getting this right matters for the ``scripts/**/*.ext``
    patterns — ``fnmatch`` treats ``*`` as crossing ``/`` and has no globstar, so
    it silently mis-classifies top-level ``scripts/foo.py`` / ``scripts/foo.sh``.
    """
    out: list[str] = []
    i, n = 0, len(glob)
    while i < n:
        c = glob[i]
        if c == "*":
            if i + 1 < n and glob[i + 1] == "*":
                # Globstar. `**/` -> zero or more leading segments; a trailing
                # `**` (or any other `**`) -> the rest of the path.
                if i + 2 < n and glob[i + 2] == "/":
                    out.append("(?:.*/)?")
                    i += 3
                else:
                    out.append(".*")
                    i += 2
            else:
                out.append("[^/]*")
                i += 1
        elif c == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(c))
            i += 1
    return re.compile("^" + "".join(out) + "$")


@dataclass(frozen=True)
class PathsFilterSimulator:
    """Simulates dorny/paths-filter evaluation against loaded workflow patterns."""

    has_code_patterns: tuple[str, ...]
    deps_patterns: tuple[str, ...]

    def evaluate(self, changed_files: list[str]) -> tuple[bool, bool]:
        """Simulate dorny/paths-filter evaluation.

        has_code uses predicate-quantifier: 'every' with '**' + negative exclusions.
        A file matches has_code iff:
          - it matches '**' AND
          - it does NOT match any negative exclusion pattern '!pattern'.
        has_code is true if AT LEAST ONE changed file matches has_code.

        deps uses default quantifier 'some'.
        deps is true if ANY changed file matches ANY deps pattern.
        """
        has_code = False
        for f in changed_files:
            matches_every = True
            for pat in self.has_code_patterns:
                if pat.startswith("!"):
                    if _glob_to_regex(pat[1:]).match(f):
                        matches_every = False
                        break
                else:
                    if not _glob_to_regex(pat).match(f):
                        matches_every = False
                        break
            if matches_every:
                has_code = True
                break

        has_deps = False
        for f in changed_files:
            for pat in self.deps_patterns:
                if _glob_to_regex(pat).match(f):
                    has_deps = True
                    break
            if has_deps:
                break

        return has_code, has_deps


@pytest.fixture(scope="module")
def ci_workflow() -> dict:
    """Load and parse ci.yml once for the test module."""
    content = CI_YML_PATH.read_text(encoding="utf-8")
    return yaml.safe_load(content)


@pytest.fixture(scope="module")
def paths_filter(ci_workflow: dict) -> PathsFilterSimulator:
    """Extract has_code and deps patterns from ci.yml into a simulator."""
    changes_steps = ci_workflow["jobs"]["changes"]["steps"]
    has_code_patterns: list[str] = []
    deps_patterns: list[str] = []

    for step in changes_steps:
        uses = step.get("uses", "")
        if "dorny/paths-filter" in uses:
            filters_raw = step.get("with", {}).get("filters", "")
            filters_obj = yaml.safe_load(filters_raw)
            if "has_code" in filters_obj:
                has_code_patterns = filters_obj["has_code"]
            if "deps" in filters_obj:
                deps_patterns = filters_obj["deps"]

    assert has_code_patterns, "Failed to find has_code patterns in ci.yml"
    assert deps_patterns, "Failed to find deps patterns in ci.yml"
    return PathsFilterSimulator(
        has_code_patterns=tuple(has_code_patterns),
        deps_patterns=tuple(deps_patterns),
    )


def test_recent_non_website_prs_bypass_tests(
    paths_filter: PathsFilterSimulator,
) -> None:
    """Regression test against real file lists from recent PRs that took forever."""
    recent_prs: dict[str, list[str]] = {
        "PR #2073 (perf: pytest-xdist)": [
            "pytest.ini",
            "scripts/README.md",
            "scripts/check-pytest.sh",
            "scripts/requirements.txt",
            "scripts/tests/test_dev_status.py",
            "scripts/tests/test_pytest_output_policy.py",
        ],
        "PR #2070 tooling subset (without TS unit tests)": [
            ".agents/hooks.json",
            ".agents/skills/pinpoint-pr-workflow/SKILL.md",
            ".claude/hooks/block-direct-pr-watch.cjs",
            ".claude/hooks/verify-guard-stack.cjs",
            ".claude/settings.json",
            ".codex/agents/pr-lifecycle-watcher.toml",
            ".codex/config.toml",
            ".codex/hooks.json",
            "scripts/tests/test_node_hook_paths.py",
            "scripts/tests/test_pr_watcher_agents.py",
        ],
        "PR #2058 (chore: scope permissions)": [
            ".codex/rules/pinpoint.rules",
            "scripts/tests/test_codex_gh.py",
            "scripts/tests/test_codex_git.py",
            "scripts/workflow/AGENTS.md",
            "scripts/workflow/codex-gh.sh",
            "scripts/workflow/codex-git.sh",
        ],
        "PR #2055 (fix: hide pytest locals)": [
            "pytest.ini",
            "scripts/README.md",
            "scripts/tests/test_pytest_output_policy.py",
        ],
        "PR #2053 (feat: delegate PR watcher)": [
            ".agents/skills/pinpoint-pr-workflow/SKILL.md",
            "scripts/tests/test_pr_dashboard.py",
            "scripts/tests/test_pr_gates.py",
            "scripts/tests/test_pr_watch.py",
            "scripts/workflow/AGENTS.md",
            "scripts/workflow/_pr-gates.sh",
            "scripts/workflow/codex-reaction-witness.sh",
            "scripts/workflow/pr-dashboard.py",
            "scripts/workflow/pr-watch.py",
        ],
        "PR #2046 (chore: tag bot PRs)": [
            ".agents/skills/pinpoint-pr-workflow/SKILL.md",
            ".github/dependabot.yml",
            ".github/renovate.json",
            ".github/workflows/ownerless-renovate-issues.yaml",
            "AGENTS.md",
            "docs/runbooks/cloud-routines-beads-access.md",
        ],
        "PR #2045 (fix: pin worktree bootstrap)": [
            "scripts/README.md",
            "scripts/tests/test_post_checkout_hook.py",
            "scripts/tests/test_worktree_setup.py",
            "scripts/worktree_setup.py",
        ],
        "PR #2044 (fix: beads cloud assets)": [
            "docs/runbooks/cloud-routines-beads-access.md",
            "scripts/beads-cloud-setup.sh",
            "scripts/beads-compatibility.json",
            "scripts/tests/test_beads_compatibility.py",
        ],
    }

    for pr_name, files in recent_prs.items():
        has_code, has_deps = paths_filter.evaluate(files)
        assert not has_code, f"{pr_name} incorrectly flagged as has_code=True: {files}"
        assert not has_deps, f"{pr_name} incorrectly flagged as has_deps=True: {files}"


def test_package_json_prs_trigger_tests(
    paths_filter: PathsFilterSimulator,
) -> None:
    """package.json edits must trigger full CI (PP-9jar).

    Before PP-9jar, `!package.json` in the has_code filter let a package.json-only
    PR skip typecheck/lint/test/build/E2E entirely while ci-gate still went green.
    These are real file lists from PRs that used to bypass and now must not.
    """
    package_json_prs: dict[str, list[str]] = {
        "PR #2068 (feat: separate check:python)": [
            "AGENTS.md",
            "package.json",
            "scripts/README.md",
            "scripts/tests/test_beads_compatibility.py",
            "scripts/tests/test_worktree_reap.py",
        ],
        "PR #2067 (feat: compact E2E output)": [
            "package.json",
            "scripts/tests/test_e2e_all_isolated.py",
            "scripts/workflow/e2e-all-isolated.sh",
        ],
        "PR #2063 (feat: quiet status output)": [
            "package.json",
            "scripts/dev-status.sh",
            "scripts/workflow/orchestration-status.sh",
        ],
        "PR #2060 (feat: quiet validation)": [
            "AGENTS.md",
            "package.json",
            "pytest.ini",
            "scripts/quiet-run.py",
            "scripts/workflow/preflight-locked.sh",
        ],
    }
    for pr_name, files in package_json_prs.items():
        has_code, _ = paths_filter.evaluate(files)
        assert has_code, f"{pr_name} must trigger CI (has_code=True): {files}"


def test_scripts_ts_js_trigger_tests(
    paths_filter: PathsFilterSimulator,
) -> None:
    """TS/JS under scripts/ is real code and must trigger full CI (PP-9jar).

    scripts/migrate-production.ts runs on every Vercel prod build and
    scripts/lib/pg-client.mjs is the PP-d8l8 prod commit-loss file; both are in
    tsconfig.app.json. They must get typecheck/lint/test/build, unlike the
    Python/shell/data files under scripts/ which stay excluded.
    """
    code_files = [
        "scripts/migrate-production.ts",
        "scripts/lib/pg-client.mjs",
        "scripts/lib/drizzle-push-guard.ts",
        "scripts/workflow/pr-watcher-mcp.ts",
        "scripts/workflow/pr-watcher-mcp.test.ts",
    ]
    for f in code_files:
        has_code, _ = paths_filter.evaluate([f])
        assert has_code, f"scripts code file must trigger CI (has_code=True): {f}"


def test_scripts_non_code_files_bypass_tests(
    paths_filter: PathsFilterSimulator,
) -> None:
    """Python/shell/data files under scripts/ stay excluded (PP-9jar).

    Guards the intentional divergence between picomatch (dorny) and fnmatch:
    top-level scripts/*.py and scripts/*.sh are excluded by scripts/**/*.{py,sh}
    (globstar spans zero segments), which fnmatch would get wrong.
    """
    non_code_files = [
        "scripts/quiet-run.py",  # top-level .py
        "scripts/worktree_setup.py",  # top-level .py
        "scripts/dev-status.sh",  # top-level .sh
        "scripts/check-pytest.sh",  # top-level .sh
        "scripts/workflow/orchestration-status.sh",  # nested .sh
        "scripts/requirements.txt",  # data
        "scripts/beads-compatibility.json",  # data
        "scripts/sql/readonly-role.sql",  # data
        "scripts/tests/test_dev_status.py",  # python test tree
    ]
    for f in non_code_files:
        has_code, _ = paths_filter.evaluate([f])
        assert not has_code, f"scripts non-code file must bypass (has_code=False): {f}"


def test_ts_unit_tests_trigger_ci_tests(
    paths_filter: PathsFilterSimulator,
) -> None:
    """TypeScript/Vitest unit tests under src/test/unit/** must trigger CI test-unit job."""
    pr_2070_ts_tests = [
        "src/test/unit/hooks/block-direct-pr-watch.test.ts",
        "src/test/unit/hooks/verify-guard-stack.test.ts",
    ]
    has_code, _ = paths_filter.evaluate(pr_2070_ts_tests)
    assert has_code, (
        "TypeScript unit test changes must trigger CI tests (has_code=True)"
    )


WEBSITE_SAMPLE_FILES = [
    "src/app/(app)/page.tsx",
    "src/app/(app)/m/[id]/page.tsx",
    "src/components/machines/PinballMapLinkField.tsx",
    "src/server/db/schema.ts",
    "src/server/services/issues.ts",
    "src/lib/auth.ts",
    "src/types/index.ts",
    "src/proxy.ts",
    "src/instrumentation.ts",
    "public/logo.svg",
    "content/about.mdx",
    "next.config.ts",
    "postcss.config.mjs",
    "components.json",
    "vercel.json",
    "drizzle/0071_location_stamps.sql",
    "drizzle.config.ts",
    "supabase/config.toml.template",
    "supabase/migrations/20260824000000_schema.sql",
    "e2e/smoke/auth.spec.ts",
    "e2e/full/issues-crud.spec.ts",
    "playwright.config.ts",
    "src/test/unit/auth-validation.test.ts",
    "vitest.config.ts",
]


@pytest.mark.parametrize("file_path", WEBSITE_SAMPLE_FILES)
def test_website_changes_trigger_tests(
    paths_filter: PathsFilterSimulator, file_path: str
) -> None:
    """Website application code must always trigger CI tests."""
    has_code, _ = paths_filter.evaluate([file_path])
    assert has_code, (
        f"Website file {file_path} was incorrectly skipped (has_code=False)"
    )


CI_CRITICAL_FILES = [
    ".github/workflows/ci.yml",
    ".github/actions/setup-mise/action.yml",
    ".github/actions/setup-supabase/action.yml",
    ".github/actions/reserve-supabase-ports/action.yml",
]


@pytest.mark.parametrize("file_path", CI_CRITICAL_FILES)
def test_ci_workflow_and_actions_trigger_tests(
    paths_filter: PathsFilterSimulator, file_path: str
) -> None:
    """Changes to CI workflow or composite actions must trigger full CI."""
    has_code, _ = paths_filter.evaluate([file_path])
    assert has_code, f"CI file {file_path} was incorrectly skipped (has_code=False)"


DEP_FILES = [
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
]


@pytest.mark.parametrize("file_path", DEP_FILES)
def test_dependency_updates_trigger_deps_filter(
    paths_filter: PathsFilterSimulator, file_path: str
) -> None:
    """Lockfile and workspace dependency updates must trigger deps=True."""
    _, has_deps = paths_filter.evaluate([file_path])
    assert has_deps, f"Dependency file {file_path} was not flagged as deps=True"


def test_setup_job_gates_on_code_or_deps(ci_workflow: dict) -> None:
    """The setup job must gate on both code and deps."""
    setup_if = ci_workflow["jobs"]["setup"]["if"]
    assert "needs.changes.outputs.code == 'true'" in setup_if
    assert "needs.changes.outputs.deps == 'true'" in setup_if


def test_mixed_changes_trigger_tests(paths_filter: PathsFilterSimulator) -> None:
    """A PR mixing non-code files with a website file must trigger tests."""
    mixed_files = [
        "docs/README.md",
        "scripts/tests/test_dev_status.py",
        "pytest.ini",
        "src/app/(app)/page.tsx",
    ]

    has_code, _ = paths_filter.evaluate(mixed_files)
    assert has_code, "Mixed PR containing website code was not flagged as has_code=True"
