"""Unit tests for scripts/workflow/evaluate-e2e-results.sh.

This script is the ONLY thing that can turn a red comprehensive E2E suite into a red
job — each comprehensive leg's Playwright step carries `continue-on-error: true` so
that non-gating Mobile Safari failures don't fail the job. Everything it gets wrong is silent.

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
import re
import subprocess
from pathlib import Path

import yaml

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
    tmp_path: Path,
    payload: object | None,
    *,
    label: str = "Full",
    test_list: list[str] | None = None,
) -> tuple[int, str, str]:
    """Run the script against `payload`; `None` means write no file at all.

    `test_list` writes a leg's --test-list file and passes it as the third argument.
    """
    results = tmp_path / "results.json"
    if payload is not None:
        results.write_text(payload if isinstance(payload, str) else json.dumps(payload))
    summary = tmp_path / "step-summary.md"
    args = ["bash", str(SCRIPT_PATH), label, str(results)]
    if test_list is not None:
        listing = tmp_path / "e2e-shard.txt"
        listing.write_text("".join(f"{line}\n" for line in test_list))
        args.append(str(listing))
    proc = subprocess.run(
        args,
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
    """WebKit is non-gating (PP-jvow), so CI reports its red without blocking."""
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


# --- 5. a leg's assigned files ---------------------------------------------------------


def _with_file(entry: dict, file: str) -> dict:
    return {**entry, "file": file}


def _leg_report(*, skipped_file_status: str = "skipped") -> dict:
    """A leg that ran a.spec.ts and auth-setup; b.spec.ts's test has `skipped_file_status`."""
    return report(
        files=[
            described("a.spec.ts", "A", [spec("chromium", "a works", True)]),
            described(
                "b.spec.ts",
                "B",
                [
                    _with_file(
                        spec("chromium", "b works", True, status=skipped_file_status),
                        "b.spec.ts",
                    )
                ],
            ),
        ],
        root_specs=[
            _with_file(spec("auth-setup", "authenticate", True), "auth.setup.ts")
        ],
    )


def test_every_assigned_file_ran_passes(tmp_path: Path) -> None:
    code, _, _ = run(
        tmp_path,
        _leg_report(skipped_file_status="expected"),
        test_list=["a.spec.ts", "b.spec.ts"],
    )
    assert code == 0


def test_assigned_file_absent_from_report_is_not_green(tmp_path: Path) -> None:
    """A --test-list path that matches nothing still leaves auth-setup green.

    --test-list turns off Playwright's "no tests found" error, and the dependency
    project runs regardless, so only this comparison notices the file never ran.
    """
    code, stdout, written = run(
        tmp_path,
        _leg_report(skipped_file_status="expected"),
        test_list=["a.spec.ts", "b.spec.ts", "renamed/c.spec.ts"],
    )
    assert code == 1
    assert "renamed/c.spec.ts" in stdout
    assert "no verdict" in written
    assert "compare the list's paths" in written
    assert "timeout or a crash" not in written


def test_red_leg_names_its_failures_even_with_a_missing_file(tmp_path: Path) -> None:
    payload = report(
        files=[described("a.spec.ts", "A", [spec("chromium", "a breaks", False)])]
    )
    code, stdout, _ = run(tmp_path, payload, test_list=["a.spec.ts", "gone.spec.ts"])
    assert code == 1
    assert "a breaks" in stdout


def test_assigned_file_with_only_skipped_tests_passes(tmp_path: Path) -> None:
    """A file quarantined with `test.describe.fixme` loads and skips; that is not a failure."""
    code, _, _ = run(tmp_path, _leg_report(), test_list=["a.spec.ts", "b.spec.ts"])
    assert code == 0


def test_test_list_is_read_the_way_playwright_reads_it(tmp_path: Path) -> None:
    """Trimmed lines, CRLF endings, blanks, and `#` comments are not assigned files."""
    code, _, _ = run(
        tmp_path,
        _leg_report(skipped_file_status="expected"),
        test_list=["# leg 1", "  a.spec.ts\r", "", "b.spec.ts  "],
    )
    assert code == 0


def test_blank_only_test_list_is_not_green(tmp_path: Path) -> None:
    code, _, written = run(
        tmp_path, _leg_report(skipped_file_status="expected"), test_list=["", "  "]
    )
    assert code == 1
    assert "names no file" in written


def test_leg_with_every_browser_test_skipped_is_not_green(tmp_path: Path) -> None:
    """auth-setup always runs, so the stats-based checks alone would call this green."""
    payload = report(
        files=[
            described("a.spec.ts", "A", [spec("chromium", "a", True, status="skipped")])
        ],
        root_specs=[
            _with_file(spec("auth-setup", "authenticate", True), "auth.setup.ts")
        ],
    )
    code, _, written = run(tmp_path, payload, test_list=["a.spec.ts"])
    assert code == 1
    assert "only auth-setup ran" in written


def test_missing_test_list_file_explains_itself(tmp_path: Path) -> None:
    results = tmp_path / "results.json"
    results.write_text(json.dumps(_leg_report(skipped_file_status="expected")))
    summary = tmp_path / "step-summary.md"
    proc = subprocess.run(
        ["bash", str(SCRIPT_PATH), "x", str(results), str(tmp_path / "absent.txt")],
        capture_output=True,
        text=True,
        env={
            "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin",
            "GITHUB_STEP_SUMMARY": str(summary),
        },
        check=False,
    )
    assert proc.returncode == 1
    assert "did not write it" in summary.read_text()


def test_empty_test_list_is_not_green(tmp_path: Path) -> None:
    code, _, written = run(
        tmp_path, _leg_report(skipped_file_status="expected"), test_list=[]
    )
    assert code == 1
    assert "no verdict" in written


def _comprehensive_job() -> str:
    ci = _ci_yml()
    return ci.split("\n  test-e2e-comprehensive:\n", 1)[1].split("\n  gitleaks:", 1)[0]


def _step(job: str, name_prefix: str) -> str:
    """One step's YAML, without comments, from its `- name:` line to the next step.

    Comments are dropped because the comment block above the NEXT step sits
    between the two `- name:` lines and talks about continue-on-error itself.
    """
    block = job.split(f"      - name: {name_prefix}", 1)[1]
    block = block.split("\n      - name: ", 1)[0]
    return "\n".join(
        line for line in block.splitlines() if not line.lstrip().startswith("#")
    )


def test_workflow_evaluates_the_report_its_run_wrote() -> None:
    """The evaluate step must read the path the run step writes, after clearing it.

    A report left by anything earlier, read as this run's verdict, is the false
    green PP-jxhy found: the reporter writes once, at the end, so a run that
    dies leaves the old file in place.
    """
    job = _comprehensive_job()
    run_step = _step(job, "Run Comprehensive")
    evaluate = _step(job, "Evaluate gating browser results")
    path = "playwright-report/results.json"
    assert f"PLAYWRIGHT_JSON_OUTPUT_NAME: {path}" in run_step
    assert f"rm -f {path}" in run_step
    assert (
        f'evaluate-e2e-results.sh "$LABEL" {path} "$RUNNER_TEMP/e2e-shard.txt"'
        in evaluate
    )


def _ci_yml() -> str:
    return (
        Path(__file__).parent.parent.parent / ".github" / "workflows" / "ci.yml"
    ).read_text()


def test_the_evaluate_step_is_the_gate() -> None:
    """The run step must not fail the leg; the evaluate step must.

    The run step is continue-on-error because Mobile Safari is non-gating: a red
    WebKit spec fails Playwright but must not fail the leg. That leaves the
    evaluate step as the only thing that turns a red gating browser, a missing
    report, or an empty run into a red leg, so it must NOT be continue-on-error.
    """
    job = _comprehensive_job()
    assert "continue-on-error: true" in _step(job, "Run Comprehensive")
    assert "continue-on-error" not in _step(job, "Evaluate gating browser results")
    assert "continue-on-error" not in _step(job, "Select this shard's spec files")


def test_shard_selection_has_its_own_timeout() -> None:
    """A hung `--list` must fail its step, not run out the job and read as cancelled."""
    assert "timeout-minutes:" in _step(
        _comprehensive_job(), "Select this shard's spec files"
    )


def test_matrix_legs_partition_each_suite() -> None:
    """Each suite's legs are shards 1..total exactly once, with one shared total.

    e2e-shard-files.py partitions a suite into `total` shards, so a leg whose
    `total` disagrees with its siblings, or a missing or duplicated shard
    number, runs some spec files twice or not at all while every leg stays
    green.
    """
    workflow = yaml.safe_load(_ci_yml())
    legs = workflow["jobs"]["test-e2e-comprehensive"]["strategy"]["matrix"]["include"]
    suites: dict[str, list[dict]] = {}
    for leg in legs:
        suites.setdefault(leg["suite"], []).append(leg)
    assert set(suites) == {"smoke", "full"}
    for suite, entries in suites.items():
        totals = {leg["total"] for leg in entries}
        assert len(totals) == 1, f"{suite} legs disagree on total: {totals}"
        (total,) = totals
        assert sorted(leg["shard"] for leg in entries) == list(range(1, total + 1)), (
            suite
        )


def test_one_red_leg_does_not_cancel_the_others() -> None:
    """fail-fast would cancel the sibling legs and leave their verdicts unknown."""
    job = _comprehensive_job()
    assert "fail-fast: false" in job.split("steps:", 1)[0]


def test_main_runs_one_at_a_time_and_prs_cancel_superseded_runs() -> None:
    """Main runs share one group and are never cancelled mid-run; PR runs cancel.

    A shared group with cancel-in-progress cut the comprehensive suite off
    mid-run (run 31755670441) — a missing verdict, the class this gate exists to
    remove. Per-SHA groups (PP-tbhv) fixed that but ran every merge at once and
    crowded the account's concurrent-job cap. One group per ref with
    cancel-in-progress only for pull_request gives main one running run plus one
    waiting, and keeps PR cancellation. (PP-yva7.7.)
    """
    ci = _ci_yml()
    # Scope to the workflow-level block. A job-level `concurrency:` elsewhere
    # would govern only that one job, so a whole-file substring check could keep
    # passing while the setting it claims to pin had moved or been flipped.
    block = ci.split("\nconcurrency:\n", 1)[1].split("\njobs:", 1)[0]
    assert "group: ${{ github.workflow }}-${{ github.ref }}\n" in block, block
    assert "github.sha" not in block, (
        "main runs must share one group, not one per commit"
    )
    assert "cancel-in-progress: ${{ github.event_name == 'pull_request' }}" in block, (
        block
    )


def test_job_timeout_exceeds_the_sum_of_step_budgets() -> None:
    """The backstop must clear the step budget plus a COLD-cache setup.

    The node_modules cache keys on the lockfile hash, so every dependency bump
    that lands on main misses it and pays a full install.
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


def test_ci_gate_fails_on_cancelled_or_failed_jobs() -> None:
    """CI Gate must fail if any upstream job was cancelled (e.g. timeout) or failed.

    When a Tier 2 job (like E2E full or smoke) hits its timeout-minutes, GitHub
    Actions reports its conclusion as 'cancelled'. In PP-tdoq (observed on PR #1833),
    CI Gate previously treated 'cancelled' as passing for path-filtered jobs,
    allowing a green gate over an aborted/timed-out run.

    CI Gate must strictly fail on both 'failure' and 'cancelled', so a timed-out
    job turns CI Gate red instead of green (PP-tdoq).
    """
    ci = _ci_yml()
    gate_block = ci.split("\n  ci-gate:\n", 1)[1]
    needs_block = gate_block.split("steps:", 1)[0]
    # Gate must depend on all upstream jobs, anchored to full lines so that
    # e.g. - test-integration does not pass vacuously by matching - test-integration-supabase.
    for job in (
        "changes",
        "setup",
        "static",
        "linters",
        "gitleaks",
        "test-integration",
        "test-migrations",
        "test-integration-supabase",
        "test-e2e-smoke",
        "test-e2e-smoke-mobile-chrome",
        "test-e2e-full-chromium",
        "test-e2e-comprehensive",
        "pnpm-audit",
    ):
        assert re.search(rf"^\s+- {re.escape(job)}$", needs_block, re.M), (
            f"ci-gate must declare need: {job}"
        )

    # Gate must run always() so it can evaluate upstream job states
    assert "if: always()" in gate_block
    # Gate must fail on both failure AND cancelled
    assert "contains(needs.*.result, 'failure')" in gate_block
    assert "contains(needs.*.result, 'cancelled')" in gate_block
