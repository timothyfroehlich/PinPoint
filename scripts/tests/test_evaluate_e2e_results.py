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


def spec(project: str, title: str, ok: bool) -> dict:
    """One entry in a suite's `specs` array.

    Playwright emits a separate spec object per project — verified against run
    31430839981, where all 210 specs had exactly one entry in `tests`. That is why
    reading `.tests[0].projectName` is sound.
    """
    return {"title": title, "ok": ok, "tests": [{"projectName": project}]}


def report(
    *, files: list[dict] | None = None, root_specs: list[dict] | None = None
) -> dict:
    """A Playwright JSON report.

    `files` are file suites holding a describe sub-suite (the shape of every real spec);
    `root_specs` hang directly off the file suite (the shape `auth.setup.ts` produces).
    """
    suites = list(files or [])
    if root_specs:
        suites.append({"title": "auth.setup.ts", "specs": root_specs, "suites": []})
    return {"config": {"configFile": "playwright.config.full.ts"}, "suites": suites}


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
    assert "[chromium] hero shows status" in out
    assert "[chromium] hero shows status" in summary


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
    assert "Mobile Safari failures (non-gating): 1" in out


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
    assert "[Mobile Chrome] gating one" in out
    assert "safari one" not in out
    assert "Plus 1 non-gating Mobile Safari failure(s)." in summary


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
    ci = (
        Path(__file__).parent.parent.parent / ".github" / "workflows" / "ci.yml"
    ).read_text()
    suffix = workflow_label.lower()
    assert f"PLAYWRIGHT_JSON_OUTPUT_NAME: playwright-report/results-{suffix}.json" in ci
    assert (
        f"bash scripts/workflow/evaluate-e2e-results.sh {workflow_label} "
        f"playwright-report/results-{suffix}.json" in ci
    )
