"""Unit tests for scripts/workflow/evaluate-e2e-results.sh.

This script is the ONLY thing that can turn a red comprehensive E2E suite into a red
job — its two Playwright steps carry `continue-on-error: true` so that non-gating
Mobile Safari failures don't fail the job. Everything it gets wrong is silent.

Three ways it was silent before PP-jxhy, each pinned by tests below:

1. **The jq only reached top-level specs.** `.suites[].specs[]` assumes specs hang off
   the file suite, but Playwright nests them one level deeper, under the `describe`
   suite. On real run 31430839981 that expression found 3 of 210 specs — the three
   `auth.setup.ts` entries, which are the only ones with no describe block. Every
   "Gating browsers green" the job ever printed was computed over zero browser tests.
   `test_finds_failure_nested_under_describe` is the regression pin.

2. **A missing report read as green.** The JSON reporter writes once, at the end, so a
   step that times out leaves no file — and both steps used to write the same
   `results.json`, so the full run's evaluation would read the *smoke* run's green
   report. Verified on that same run: the uploaded artifact's results.json has
   `configFile: playwright.config.smoke.ts`.

3. **Zero specs read as green.** A crash in global setup or a --project typo yields a
   well-formed report with an empty spec list.

Every test drives the real bash, so the jq filters are exercised rather than mocked.
"""

import json
import subprocess
from pathlib import Path

import pytest

SCRIPT_PATH = Path(__file__).parent.parent / "workflow" / "evaluate-e2e-results.sh"


def spec(project: str, title: str, ok: bool, *, status: str | None = None) -> dict:
    """One entry in a suite's `specs` array.

    PinPoint's layout emits a separate spec object per project, but the script
    deliberately does not rely on that — see `multi_project_spec` for the merged
    shape it also has to survive. `status` defaults to matching `ok`; pass it
    explicitly for the skipped case, where `ok` is True and nothing ran.
    """
    resolved = status or ("expected" if ok else "unexpected")
    return {
        "title": title,
        "ok": ok,
        "file": "a.spec.ts",
        "line": 12,
        "tests": [{"projectName": project, "status": resolved}],
    }


def multi_project_spec(title: str, results: list[tuple[str, str]]) -> dict:
    """The shape Playwright's reporter produces when it MERGES specs.

    Specs sharing a title/file/line/column across projects collapse into one
    object whose `tests` holds every project's result, while `ok` keeps the
    first-serialised project's value. PinPoint dodges the merge only because
    `testDir` is `./e2e` while Playwright runs from the repo root — an accident
    of configuration, not a guarantee. `ok: True` here with a failing entry in
    `tests` is exactly the false green the script must not emit.
    """
    return {
        "title": title,
        "ok": True,
        "file": "a.spec.ts",
        "line": 12,
        "tests": [
            {"projectName": project, "status": status} for project, status in results
        ],
    }


def _stats_for(suites: list[dict]) -> dict:
    """Derive `stats` from the specs, the way Playwright's reporter would."""
    counts = {"expected": 0, "unexpected": 0, "flaky": 0, "skipped": 0}

    def walk(node: object) -> None:
        if isinstance(node, dict):
            for entry in node.get("specs", []) or []:
                for test in entry.get("tests", []) or []:
                    key = test.get("status", "expected")
                    if key in counts:
                        counts[key] += 1
            for child in node.get("suites", []) or []:
                walk(child)
        elif isinstance(node, list):
            for child in node:
                walk(child)

    walk(suites)
    return counts


def report(
    *,
    files: list[dict] | None = None,
    root_specs: list[dict] | None = None,
    stats: dict | None = None,
    errors: list[dict] | None = None,
) -> dict:
    """A Playwright JSON report.

    `files` are file suites holding a describe sub-suite (the shape of every real spec);
    `root_specs` hang directly off the file suite (the shape `auth.setup.ts` produces).
    `stats` defaults to whatever the specs imply; override it to model a report
    whose tally disagrees with its spec tree.
    """
    suites = list(files or [])
    if root_specs:
        suites.append({"title": "auth.setup.ts", "specs": root_specs, "suites": []})
    return {
        "config": {"configFile": "playwright.config.full.ts"},
        "suites": suites,
        "stats": stats if stats is not None else _stats_for(suites),
        "errors": errors or [],
    }


def described(file_title: str, describe_title: str, specs: list[dict]) -> dict:
    return {
        "title": file_title,
        "specs": [],
        "suites": [{"title": describe_title, "specs": specs, "suites": []}],
    }


def run(
    tmp_path: Path, payload: object | None, *, label: str = "Full"
) -> tuple[int, str, str]:
    """Run the script against `payload`; `None` means write no file at all."""
    results = tmp_path / "results.json"
    if payload is not None:
        results.write_text(payload if isinstance(payload, str) else json.dumps(payload))
    summary = tmp_path / "step-summary.md"
    proc = subprocess.run(
        ["bash", str(SCRIPT_PATH), label, str(results)],
        capture_output=True,
        text=True,
        env={
            "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin",
            "GITHUB_STEP_SUMMARY": str(summary),
        },
        check=False,
    )
    written = summary.read_text() if summary.exists() else ""
    return proc.returncode, proc.stdout, written


# --- 1. the nesting regression -------------------------------------------------------


def test_finds_failure_nested_under_describe(tmp_path: Path) -> None:
    """The pin for the bug that made this gate vacuous for its whole life.

    A failing chromium spec inside a describe block must fail the job. The old
    `.suites[].specs[]` saw nothing here at all.
    """
    payload = report(
        files=[
            described(
                "machine-info.spec.ts",
                "Machine Info tab",
                [spec("chromium", "hero shows status", False)],
            )
        ]
    )
    code, out, summary = run(tmp_path, payload)
    assert code == 1
    assert "[chromium] a.spec.ts:12 hero shows status" in out
    assert "hero shows status" in summary


def test_finds_specs_at_suite_root(tmp_path: Path) -> None:
    """auth.setup.ts has no describe block, so its specs sit at the file suite root."""
    payload = report(root_specs=[spec("auth-setup", "authenticate as admin", False)])
    code, out, _ = run(tmp_path, payload)
    assert code == 1
    assert "authenticate as admin" in out


def test_counts_specs_at_both_depths(tmp_path: Path) -> None:
    payload = report(
        files=[
            described(
                "a.spec.ts",
                "A",
                [spec("chromium", "one", True), spec("Mobile Chrome", "one", True)],
            )
        ],
        root_specs=[spec("auth-setup", "authenticate as admin", True)],
    )
    code, out, _ = run(tmp_path, payload)
    assert code == 0
    assert "3 specs" in out


# --- 2. no report means no verdict ---------------------------------------------------


def test_missing_file_fails(tmp_path: Path) -> None:
    code, out, summary = run(tmp_path, None)
    assert code == 1
    assert "did not complete" in out
    assert "no verdict" in summary


def test_empty_file_fails(tmp_path: Path) -> None:
    code, out, _ = run(tmp_path, "")
    assert code == 1
    assert "did not complete" in out


def test_truncated_json_fails(tmp_path: Path) -> None:
    """A report interrupted mid-write is not a green report."""
    code, out, _ = run(tmp_path, '{"suites": [{"title": "a.spec')
    assert code == 1
    assert "not valid JSON" in out


# --- 3. zero specs is not green ------------------------------------------------------


def test_zero_specs_fails(tmp_path: Path) -> None:
    code, out, _ = run(tmp_path, report())
    assert code == 1
    assert "0 specs" in out


# --- gating vs non-gating ------------------------------------------------------------


def test_all_green_passes(tmp_path: Path) -> None:
    payload = report(
        files=[described("a.spec.ts", "A", [spec("chromium", "works", True)])]
    )
    code, out, summary = run(tmp_path, payload)
    assert code == 0
    assert "Gating browsers green (Full)" in out
    assert "gating browsers green" in summary


def test_mobile_safari_only_failure_passes(tmp_path: Path) -> None:
    """WebKit has no crabbox home (PP-jvow), so CI reports its red without blocking."""
    payload = report(
        files=[
            described(
                "a.spec.ts",
                "A",
                [
                    spec("chromium", "works", True),
                    spec("Mobile Safari", "works", False),
                ],
            )
        ]
    )
    code, out, _ = run(tmp_path, payload)
    assert code == 0
    assert "Mobile Safari failures (non-gating, Full):" in out
    assert "works" in out


def test_skipped_suite_is_not_green(tmp_path: Path) -> None:
    """A wholly-skipped suite has a healthy spec count and zero failures.

    A committed `test.describe.skip`, or a `test.skip(cond)` whose condition
    holds everywhere, serialises every spec with `ok: true`. Nothing ran, and
    the spec walk alone cannot tell that apart from a green run — only `stats`
    can. This is the same class of silent green the gate exists to close.
    """
    payload = report(
        files=[
            described(
                "a.spec.ts",
                "A",
                [
                    spec("chromium", "one", True, status="skipped"),
                    spec("Mobile Chrome", "one", True, status="skipped"),
                ],
            )
        ]
    )
    code, out, summary = run(tmp_path, payload)
    assert code == 1
    assert "0 executed tests" in out
    assert "no verdict" in summary


def test_run_level_errors_are_not_green(tmp_path: Path) -> None:
    """A worker crash lands in `.errors` while every spec that ran stays green."""
    payload = report(
        files=[described("a.spec.ts", "A", [spec("chromium", "works", True)])],
        errors=[{"message": "Worker process exited unexpectedly"}],
    )
    code, out, _ = run(tmp_path, payload)
    assert code == 1
    assert "Worker process exited unexpectedly" in out
    assert "run-level error" in out


def test_stats_disagreeing_with_spec_walk_is_not_green(tmp_path: Path) -> None:
    """If Playwright counted failures the walk missed, the walk is untrustworthy."""
    payload = report(
        files=[described("a.spec.ts", "A", [spec("chromium", "works", True)])],
        stats={"expected": 1, "unexpected": 3, "flaky": 0, "skipped": 0},
    )
    code, out, _ = run(tmp_path, payload)
    assert code == 1
    assert "spec walk found none" in out


def test_merged_multi_project_spec_still_fails(tmp_path: Path) -> None:
    """The shape that would make a Mobile-Chrome-only failure invisible.

    One spec object, `ok: true` from the project that passed, and the failure
    only visible inside `tests[]`. Reading `.tests[0]` would call this green.
    """
    payload = report(
        files=[
            described(
                "a.spec.ts",
                "A",
                [
                    multi_project_spec(
                        "renders",
                        [("chromium", "expected"), ("Mobile Chrome", "unexpected")],
                    )
                ],
            )
        ]
    )
    code, out, _ = run(tmp_path, payload)
    assert code == 1
    assert "[Mobile Chrome]" in out
    assert "renders" in out


def test_non_gating_failures_are_named_not_just_counted(tmp_path: Path) -> None:
    """This job is WebKit's only signal — a bare count would mean downloading the artifact."""
    payload = report(
        files=[
            described(
                "a.spec.ts",
                "A",
                [
                    spec("chromium", "works", True),
                    spec("Mobile Safari", "safari regression", False),
                ],
            )
        ]
    )
    code, out, summary = run(tmp_path, payload)
    assert code == 0
    assert "safari regression" in out
    assert "safari regression" in summary


def test_mixed_failures_report_only_gating_titles(tmp_path: Path) -> None:
    payload = report(
        files=[
            described(
                "a.spec.ts",
                "A",
                [
                    spec("Mobile Chrome", "gating one", False),
                    spec("Mobile Safari", "safari one", False),
                ],
            )
        ]
    )
    code, out, summary = run(tmp_path, payload)
    assert code == 1
    # Gating failures decide the verdict; non-gating ones are still named, in
    # their own clearly-labelled block rather than mixed into the gating list.
    assert "[Mobile Chrome] a.spec.ts:12 gating one" in out
    assert "gating one" in summary
    assert "### Mobile Safari failures (non-gating): 1" in summary
    assert "safari one" in summary


def test_label_appears_in_output(tmp_path: Path) -> None:
    """Smoke and Full share the script; the label is how a reader tells them apart."""
    payload = report(
        files=[described("a.spec.ts", "A", [spec("chromium", "works", True)])]
    )
    _, out, summary = run(tmp_path, payload, label="Smoke")
    assert "(Smoke)" in out
    assert "E2E Smoke" in summary


def test_missing_arguments_fail(tmp_path: Path) -> None:
    proc = subprocess.run(
        ["bash", str(SCRIPT_PATH)], capture_output=True, text=True, check=False
    )
    assert proc.returncode != 0
    assert "usage:" in proc.stderr


@pytest.mark.parametrize("workflow_label", ["Smoke", "Full"])
def test_workflow_invokes_script_with_matching_paths(workflow_label: str) -> None:
    """The workflow must pass a per-run results path, not a shared results.json.

    Both steps writing one file is what let a dead full run inherit the smoke run's
    green report, so the distinct filenames are load-bearing rather than cosmetic.
    """
    ci = _ci_yml()
    suffix = workflow_label.lower()
    assert f"PLAYWRIGHT_JSON_OUTPUT_NAME: playwright-report/results-{suffix}.json" in ci
    assert (
        f"bash scripts/workflow/evaluate-e2e-results.sh {workflow_label} "
        f"playwright-report/results-{suffix}.json" in ci
    )


def _ci_yml() -> str:
    return (
        Path(__file__).parent.parent.parent / ".github" / "workflows" / "ci.yml"
    ).read_text()


def test_both_evaluate_steps_are_continue_on_error() -> None:
    """A red Smoke must not abort the job before Full ever runs.

    If the Smoke evaluate step's `exit 1` ended the job, one red smoke spec
    would leave main's full-suite health unknown for that commit — a missing
    verdict, which is the class this whole gate exists to remove.
    """
    ci = _ci_yml()
    for step_id in ("verdict-smoke", "verdict-full"):
        block = ci.split(f"id: {step_id}", 1)[1][:200]
        assert "continue-on-error: true" in block, step_id


def test_a_dedicated_step_gates_on_both_verdicts() -> None:
    """Something still has to fail the job once both suites have reported."""
    ci = _ci_yml()
    assert "steps.verdict-smoke.outcome == 'failure'" in ci
    assert "steps.verdict-full.outcome == 'failure'" in ci


def test_job_timeout_exceeds_the_sum_of_step_budgets() -> None:
    """The backstop must clear both step budgets plus a COLD-cache setup.

    Both caches key on the lockfile hash, so every dependency bump that lands
    on main misses them and pays install + browser download.
    """
    ci = _ci_yml()
    job = ci.split("test-e2e-comprehensive:", 1)[1].split("\n  gitleaks:", 1)[0]
    job_timeout = int(
        next(
            line.split("timeout-minutes:")[1]
            for line in job.splitlines()
            if line.strip().startswith("timeout-minutes:")
        )
    )
    step_budgets = [
        int(line.split("timeout-minutes:")[1])
        for line in job.splitlines()
        if "timeout-minutes:" in line and line.strip().startswith("timeout-minutes:")
    ][1:]
    assert job_timeout >= sum(step_budgets) + 20
