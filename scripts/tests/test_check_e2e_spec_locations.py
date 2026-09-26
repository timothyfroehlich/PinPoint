"""Tests for scripts/check_e2e_spec_locations.py — gate for E2E spec locations."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from check_e2e_spec_locations import (  # noqa: E402
    find_misplaced_specs,
    find_repo_root,
    find_spec_violations,
    main,
)


def test_current_repo_has_no_misplaced_specs():
    """Verify that current repository checkout passes the gate."""
    repo_root = find_repo_root(Path(__file__).resolve().parent)
    misplaced = find_misplaced_specs(repo_root)
    assert misplaced == []


def test_empty_or_missing_e2e_dir(tmp_path: Path):
    """Empty or missing e2e directory produces no misplaced specs."""
    assert find_misplaced_specs(tmp_path) == []

    (tmp_path / "e2e").mkdir()
    assert find_misplaced_specs(tmp_path) == []


def test_allowed_suite_directories(tmp_path: Path):
    """Valid *.spec.ts files placed under e2e/full/ or e2e/smoke/ are allowed."""
    full_spec = tmp_path / "e2e" / "full" / "dashboard.spec.ts"
    full_nested_spec = tmp_path / "e2e" / "full" / "sub" / "admin.spec.ts"
    smoke_spec = tmp_path / "e2e" / "smoke" / "auth.spec.ts"
    smoke_nested_spec = tmp_path / "e2e" / "smoke" / "nested" / "nav.spec.ts"

    full_spec.parent.mkdir(parents=True)
    full_nested_spec.parent.mkdir(parents=True)
    smoke_spec.parent.mkdir(parents=True)
    smoke_nested_spec.parent.mkdir(parents=True)

    for p in (full_spec, full_nested_spec, smoke_spec, smoke_nested_spec):
        p.write_text("// test", encoding="utf-8")

    assert find_misplaced_specs(tmp_path) == []
    assert find_spec_violations(tmp_path) == []


def test_misplaced_specs_flagged(tmp_path: Path):
    """Test files placed directly in e2e/ or in other subdirectories are flagged."""
    root_spec = tmp_path / "e2e" / "orphaned.spec.ts"
    root_test = tmp_path / "e2e" / "orphaned.test.ts"
    profiles_spec = tmp_path / "e2e" / "profiles" / "profile-edit.spec.ts"
    profiles_test = tmp_path / "e2e" / "profiles" / "profile-edit.test.ts"
    fixtures_spec = tmp_path / "e2e" / "fixtures" / "leak.spec.ts"
    support_spec = tmp_path / "e2e" / "support" / "helper.spec.ts"

    for p in (
        root_spec,
        root_test,
        profiles_spec,
        profiles_test,
        fixtures_spec,
        support_spec,
    ):
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("// test", encoding="utf-8")

    misplaced = find_misplaced_specs(tmp_path)
    assert set(misplaced) == {
        root_spec,
        root_test,
        profiles_spec,
        profiles_test,
        fixtures_spec,
        support_spec,
    }

    violations = find_spec_violations(tmp_path)
    for _, reason in violations:
        assert "outside allowed suite directories" in reason


def test_invalid_extension_under_allowed_suite_flagged(tmp_path: Path):
    """Playwright test files under full/ or smoke/ that are not *.spec.ts are flagged."""
    full_test_ts = tmp_path / "e2e" / "full" / "foo.test.ts"
    full_spec_tsx = tmp_path / "e2e" / "full" / "foo.spec.tsx"
    smoke_test_ts = tmp_path / "e2e" / "smoke" / "bar.test.ts"
    smoke_spec_js = tmp_path / "e2e" / "smoke" / "bar.spec.js"

    for p in (full_test_ts, full_spec_tsx, smoke_test_ts, smoke_spec_js):
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("// test", encoding="utf-8")

    violations = dict(find_spec_violations(tmp_path))
    for p in (full_test_ts, full_spec_tsx, smoke_test_ts, smoke_spec_js):
        assert p in violations
        assert "must end with .spec.ts" in violations[p]


def test_non_spec_files_ignored(tmp_path: Path):
    """Non-spec files under e2e/ (e.g. fixtures, helpers, configs, setups) are ignored."""
    setup_file = tmp_path / "e2e" / "auth.setup.ts"
    global_setup = tmp_path / "e2e" / "global-setup.ts"
    tsconfig = tmp_path / "e2e" / "tsconfig.json"
    helper = tmp_path / "e2e" / "support" / "actions.ts"
    fixture = tmp_path / "e2e" / "fixtures" / "data.json"

    for p in (setup_file, global_setup, tsconfig, helper, fixture):
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("{}", encoding="utf-8")

    assert find_misplaced_specs(tmp_path) == []


def test_main_clean_exit(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    """main() returns 0 on a clean repo with no output."""
    (tmp_path / "e2e" / "full").mkdir(parents=True)
    (tmp_path / "e2e" / "full" / "ok.spec.ts").write_text("// test")

    exit_code = main(["--root", str(tmp_path)])
    assert exit_code == 0

    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == ""


def test_main_failure_exit(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    """main() returns 1 and prints details when misplaced specs exist."""
    (tmp_path / "e2e" / "profiles").mkdir(parents=True)
    bad_spec = tmp_path / "e2e" / "profiles" / "profile-edit.spec.ts"
    bad_spec.write_text("// test")

    (tmp_path / "e2e" / "full").mkdir(parents=True)
    bad_ext = tmp_path / "e2e" / "full" / "bad-ext.test.ts"
    bad_ext.write_text("// test")

    exit_code = main(["--root", str(tmp_path)])
    assert exit_code == 1

    captured = capsys.readouterr()
    assert captured.out == ""
    assert "ERROR: Found 2 invalid or misplaced E2E spec file(s)" in captured.err
    assert (
        "e2e/profiles/profile-edit.spec.ts: outside allowed suite directories"
        in captured.err
    )
    assert "e2e/full/bad-ext.test.ts: must end with .spec.ts" in captured.err
    assert "playwright.config.full.ts" in captured.err


def test_directory_named_like_spec_is_ignored(tmp_path: Path):
    """A directory ending in .spec.ts is not treated as a spec file."""
    spec_dir = tmp_path / "e2e" / "profiles" / "fake.spec.ts"
    spec_dir.mkdir(parents=True)
    assert find_misplaced_specs(tmp_path) == []


def test_find_repo_root(tmp_path: Path):
    """find_repo_root walks up until package.json is found, or returns start."""
    (tmp_path / "package.json").write_text("{}", encoding="utf-8")
    nested = tmp_path / "a" / "b" / "c"
    nested.mkdir(parents=True)

    assert find_repo_root(nested) == tmp_path

    unrelated = tmp_path / "unrelated"
    unrelated.mkdir()
    # Path without package.json in its tree
    assert find_repo_root(Path("/tmp")) == Path("/tmp")


def test_main_default_root(capsys: pytest.CaptureFixture[str]):
    """main() with no arguments resolves repo root automatically and passes."""
    exit_code = main([])
    assert exit_code == 0
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == ""
