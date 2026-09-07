"""Tests for CI change detection rules in .github/workflows/ci.yml.

Verifies that PRs touching only developer tooling, Python tests, agent configs,
linters, package scripts, or non-PR workflows bypass expensive E2E, Supabase
integration, and build suites, while real website changes and CI changes
continue to run the full test suite.
"""

import fnmatch
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).parent.parent.parent
CI_YML_PATH = REPO_ROOT / ".github" / "workflows" / "ci.yml"


def _load_ci_workflow() -> dict:
    content = CI_YML_PATH.read_text(encoding="utf-8")
    return yaml.safe_load(content)


def _extract_filter_patterns() -> tuple[list[str], list[str]]:
    """Extract has_code and deps patterns from ci.yml."""
    doc = _load_ci_workflow()
    changes_steps = doc["jobs"]["changes"]["steps"]
    has_code_patterns = []
    deps_patterns = []

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
    return has_code_patterns, deps_patterns


def _eval_paths_filter(
    changed_files: list[str],
    has_code_patterns: list[str],
    deps_patterns: list[str],
) -> tuple[bool, bool]:
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
        for pat in has_code_patterns:
            if pat.startswith("!"):
                neg_pat = pat[1:]
                if fnmatch.fnmatch(f, neg_pat):
                    matches_every = False
                    break
            else:
                if not fnmatch.fnmatch(f, pat):
                    matches_every = False
                    break
        if matches_every:
            has_code = True
            break

    has_deps = False
    for f in changed_files:
        for pat in deps_patterns:
            if fnmatch.fnmatch(f, pat):
                has_deps = True
                break
        if has_deps:
            break

    return has_code, has_deps


def test_recent_non_website_prs_bypass_tests() -> None:
    """Regression test against real file lists from recent PRs that took forever."""
    has_code_pats, deps_pats = _extract_filter_patterns()

    recent_prs: dict[str, list[str]] = {
        "PR #2073 (perf: pytest-xdist)": [
            "pytest.ini",
            "scripts/README.md",
            "scripts/check-pytest.sh",
            "scripts/requirements.txt",
            "scripts/tests/test_dev_status.py",
            "scripts/tests/test_pytest_output_policy.py",
        ],
        "PR #2070 (fix: delegated PR watcher)": [
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
            "src/test/unit/hooks/block-direct-pr-watch.test.ts",
            "src/test/unit/hooks/verify-guard-stack.test.ts",
        ],
        "PR #2068 (feat: separate check:python)": [
            "AGENTS.md",
            "package.json",
            "scripts/README.md",
            "scripts/tests/test_beads_compatibility.py",
            "scripts/tests/test_chores_nag_hook.py",
            "scripts/tests/test_memory_review_apply_remote.py",
            "scripts/tests/test_merge_handoff.py",
            "scripts/tests/test_merge_pr_automerge.py",
            "scripts/tests/test_mise_project_contract.py",
            "scripts/tests/test_post_checkout_hook.py",
            "scripts/tests/test_pr_gates.py",
            "scripts/tests/test_request_codex_review.py",
            "scripts/tests/test_review_preflight.py",
            "scripts/tests/test_vercel_cli.py",
            "scripts/tests/test_worktree_create_hook.py",
            "scripts/tests/test_worktree_reap.py",
        ],
        "PR #2067 (feat: compact E2E output)": [
            "package.json",
            "scripts/tests/test_e2e_all_isolated.py",
            "scripts/tests/test_quiet_run.py",
            "scripts/workflow/e2e-all-isolated.sh",
        ],
        "PR #2063 (feat: quiet status output)": [
            "package.json",
            "scripts/dev-status.sh",
            "scripts/tests/test_dev_status.py",
            "scripts/tests/test_orchestration_status.py",
            "scripts/workflow/orchestration-status.sh",
        ],
        "PR #2060 (feat: quiet validation)": [
            "AGENTS.md",
            "package.json",
            "pytest.ini",
            "scripts/README.md",
            "scripts/quiet-run.py",
            "scripts/tests/test_prototype_clean_guard.py",
            "scripts/tests/test_pytest_output_policy.py",
            "scripts/tests/test_quiet_run.py",
            "scripts/workflow/preflight-locked.sh",
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
        has_code, has_deps = _eval_paths_filter(files, has_code_pats, deps_pats)
        assert not has_code, f"{pr_name} incorrectly flagged as has_code=True: {files}"
        assert not has_deps, f"{pr_name} incorrectly flagged as has_deps=True: {files}"


def test_website_changes_trigger_tests() -> None:
    """Website application code and tests must always trigger CI tests."""
    has_code_pats, deps_pats = _extract_filter_patterns()

    app_files = [
        "src/app/(app)/page.tsx",
        "src/app/(app)/m/[id]/page.tsx",
        "src/components/machines/PinballMapLinkField.tsx",
        "src/server/db/schema.ts",
        "src/server/services/issues.ts",
        "src/lib/auth.ts",
        "src/types/index.ts",
        "src/middleware.ts",
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
        "src/test/integration/pinballmap.test.ts",
        "vitest.config.ts",
    ]

    for f in app_files:
        has_code, _ = _eval_paths_filter([f], has_code_pats, deps_pats)
        assert has_code, f"Website file {f} was incorrectly skipped (has_code=False)"


def test_ci_workflow_and_actions_trigger_tests() -> None:
    """Changes to CI workflow or composite actions must trigger full CI."""
    has_code_pats, deps_pats = _extract_filter_patterns()

    ci_files = [
        ".github/workflows/ci.yml",
        ".github/actions/setup-mise/action.yml",
        ".github/actions/setup-supabase/action.yml",
        ".github/actions/reserve-supabase-ports/action.yml",
    ]

    for f in ci_files:
        has_code, _ = _eval_paths_filter([f], has_code_pats, deps_pats)
        assert has_code, f"CI file {f} was incorrectly skipped (has_code=False)"


def test_dependency_updates_trigger_deps_filter() -> None:
    """Lockfile and workspace dependency updates must trigger deps=True."""
    has_code_pats, deps_pats = _extract_filter_patterns()

    dep_files = [
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
    ]

    for f in dep_files:
        _, has_deps = _eval_paths_filter([f], has_code_pats, deps_pats)
        assert has_deps, f"Dependency file {f} was not flagged as deps=True"


def test_setup_job_gates_on_code_or_deps() -> None:
    """The setup job must gate on both code and deps."""
    doc = _load_ci_workflow()
    setup_if = doc["jobs"]["setup"]["if"]
    assert "needs.changes.outputs.code == 'true'" in setup_if
    assert "needs.changes.outputs.deps == 'true'" in setup_if


def test_mixed_changes_trigger_tests() -> None:
    """A PR mixing non-code files with a website file must trigger tests."""
    has_code_pats, deps_pats = _extract_filter_patterns()

    mixed_files = [
        "docs/README.md",
        "scripts/tests/test_dev_status.py",
        "pytest.ini",
        "src/app/(app)/page.tsx",
    ]

    has_code, _ = _eval_paths_filter(mixed_files, has_code_pats, deps_pats)
    assert has_code, "Mixed PR containing website code was not flagged as has_code=True"
