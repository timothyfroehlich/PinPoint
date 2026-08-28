"""Tests for the PinPoint mise project contract (PP-h2ui.4, .5, .6).

Verifies that:
1. mise.toml defines the exact development Node/Python/Ruff/Supabase-CLI runtimes and settings.
2. package.json#packageManager remains the single pnpm version and checksum authority.
3. mise.toml does not duplicate the pnpm version (idiomatic_version_file_enable_tools is used).
4. mise.lock exists and captures resolved artifacts across platforms.
5. mise rejects mismatched packageManager checksum suffixes (negative test).
6. mise meets the minimum version requirement (>= 2026.8.11).
7. CI's supabase/setup-cli blocks mirror the single mise.toml Supabase CLI pin (PP-h2ui.6).
"""

import json
import os
import re
import shutil
import subprocess
from pathlib import Path

try:
    import tomllib
except ImportError:
    import tomli as tomllib  # type: ignore[no-redef]

REPO_ROOT = Path(__file__).parent.parent.parent
MISE_TOML_PATH = REPO_ROOT / "mise.toml"
MISE_LOCK_PATH = REPO_ROOT / "mise.lock"
PACKAGE_JSON_PATH = REPO_ROOT / "package.json"
RUFF_TOML_PATH = REPO_ROOT / "ruff.toml"
REQUIREMENTS_TXT_PATH = REPO_ROOT / "scripts" / "requirements.txt"
CHECK_PYTEST_PATH = REPO_ROOT / "scripts" / "check-pytest.sh"
CI_WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "ci.yml"

MINIMUM_MISE_VERSION = (2026, 8, 11)


def _parse_mise_version(raw: str) -> tuple[int, ...]:
    """Extract (year, month, patch) tuple from mise version output."""
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)", raw.strip())
    if not match:
        raise ValueError(f"Could not parse mise version from {raw!r}")
    return tuple(int(x) for x in match.groups())


def _get_mise_bin() -> str:
    """Return the absolute path to the mise binary, failing loudly if absent from PATH."""
    mise_bin = shutil.which("mise")
    assert mise_bin is not None, (
        "mise binary must be installed and available on PATH to run project contract tests"
    )
    return mise_bin


def test_mise_toml_exists_and_is_valid() -> None:
    assert MISE_TOML_PATH.is_file(), f"expected {MISE_TOML_PATH} to exist"
    data = tomllib.loads(MISE_TOML_PATH.read_text(encoding="utf-8"))

    # Top-level min_version must be enforced
    assert data.get("min_version") == "2026.8.11", (
        f"mise.toml must enforce min_version = '2026.8.11', got {data.get('min_version')!r}"
    )

    # Node, Python, Ruff, and Supabase CLI development runtime must be pinned
    tools = data.get("tools", {})
    assert "node" in tools, "mise.toml must specify node in [tools]"
    assert tools["node"] == "24.16.0", f"expected node 24.16.0, got {tools['node']!r}"
    assert "python" in tools, "mise.toml must specify python in [tools]"
    assert tools["python"] == "3.12.9", (
        f"expected python 3.12.9, got {tools['python']!r}"
    )
    assert "ruff" in tools, "mise.toml must specify ruff in [tools]"
    assert tools["ruff"] == "0.15.1", f"expected ruff 0.15.1, got {tools['ruff']!r}"
    assert "supabase" in tools, "mise.toml must specify supabase in [tools]"
    assert re.fullmatch(r"\d+\.\d+\.\d+", str(tools["supabase"])), (
        f"expected an exact supabase CLI pin (X.Y.Z), got {tools['supabase']!r}"
    )

    # pnpm must NOT be duplicated in [tools]
    assert "pnpm" not in tools, (
        "pnpm must not be declared in mise.toml [tools]; "
        "package.json#packageManager is the single authority via idiomatic_version_file_enable_tools"
    )

    # Settings verification
    settings = data.get("settings", {})
    idiomatic_tools = settings.get("idiomatic_version_file_enable_tools", [])
    assert "pnpm" in idiomatic_tools, (
        "mise.toml must enable pnpm in [settings].idiomatic_version_file_enable_tools"
    )
    assert settings.get("not_found_auto_install") is False, (
        "mise.toml must set not_found_auto_install = false to prevent surprise installs"
    )
    assert settings.get("not_found_system_fallback") is False, (
        "mise.toml must set not_found_system_fallback = false to prevent silent fallback"
    )


def test_package_json_pnpm_authority() -> None:
    assert PACKAGE_JSON_PATH.is_file(), f"expected {PACKAGE_JSON_PATH} to exist"
    pkg = json.loads(PACKAGE_JSON_PATH.read_text(encoding="utf-8"))

    # packageManager must declare pnpm version and sha512 integrity suffix
    pkg_mgr = pkg.get("packageManager", "")
    match = re.match(r"^pnpm@(\d+\.\d+\.\d+)\+sha512\.([0-9a-f]{128})$", pkg_mgr)
    assert match is not None, (
        f"package.json#packageManager must be pnpm@<version>+sha512.<hash>, got {pkg_mgr!r}"
    )

    # engines.node must be defined as deployment compatibility contract
    engines = pkg.get("engines", {})
    assert "node" in engines, "package.json must declare engines.node"


def test_mise_lock_exists_and_captures_tools() -> None:
    assert MISE_LOCK_PATH.is_file(), f"expected {MISE_LOCK_PATH} to exist"
    data = tomllib.loads(MISE_LOCK_PATH.read_text(encoding="utf-8"))

    assert "lockfile_version" in data, "mise.lock must have lockfile_version"
    tools = data.get("tools", {})
    assert "node" in tools, "mise.lock must have node tool locked"
    assert "pnpm" in tools, "mise.lock must have pnpm tool locked"
    assert "python" in tools, "mise.lock must have python tool locked"
    assert "ruff" in tools, "mise.lock must have ruff tool locked"
    assert "supabase" in tools, "mise.lock must have supabase tool locked"


def test_mise_cli_version_meets_minimum() -> None:
    mise_bin = _get_mise_bin()

    proc = subprocess.run(
        [mise_bin, "--version"],
        capture_output=True,
        text=True,
        check=True,
    )
    version_tuple = _parse_mise_version(proc.stdout)
    assert version_tuple >= MINIMUM_MISE_VERSION, (
        f"mise version {proc.stdout.strip()} is older than minimum required {MINIMUM_MISE_VERSION}"
    )


def _tool_source_path(info: object) -> str:
    """Extract the config-file source path for a tool from `mise ls --json`.

    A tool entry is a list of installed versions when more than one is present
    (e.g. a stale pnpm alongside the pinned one); only the active/requested
    entry carries a `source`. Selecting index 0 blindly can pick an inactive
    install that has no `source` key, so scan for the entry that declares one.
    """
    candidates = info if isinstance(info, list) else [info]
    for entry in candidates:
        if isinstance(entry, dict) and isinstance(entry.get("source"), dict):
            return str(entry["source"]["path"])
    raise AssertionError(f"no active entry with a source path in {info!r}")


def test_mise_ls_resolves_sources_correctly() -> None:
    mise_bin = _get_mise_bin()

    proc = subprocess.run(
        [mise_bin, "ls", "--json"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    tools_list = json.loads(proc.stdout)
    if isinstance(tools_list, dict):
        tools_dict = tools_list
    else:
        tools_dict = {t["name"]: t for t in tools_list if "name" in t}

    assert "node" in tools_dict, "node not listed by mise ls"
    assert "pnpm" in tools_dict, "pnpm not listed by mise ls"
    assert "python" in tools_dict, "python not listed by mise ls"
    assert "ruff" in tools_dict, "ruff not listed by mise ls"
    assert "supabase" in tools_dict, "supabase not listed by mise ls"

    # pnpm's version is authored in package.json; the rest are pinned in mise.toml.
    expected_sources = {
        "node": "mise.toml",
        "pnpm": "package.json",
        "python": "mise.toml",
        "ruff": "mise.toml",
        "supabase": "mise.toml",
    }
    for tool, expected_file in expected_sources.items():
        source = _tool_source_path(tools_dict[tool])
        assert source.endswith(expected_file), (
            f"{tool} source should be {expected_file}, got {source}"
        )


def test_negative_checksum_mismatch_rejected(tmp_path: Path) -> None:
    mise_bin = _get_mise_bin()

    # Create an isolated sandbox with mise.toml and a package.json with a bad sha512
    test_mise_toml = tmp_path / "mise.toml"
    test_mise_toml.write_text(
        'min_version = "2026.8.11"\n\n'
        '[tools]\nnode = "24.16.0"\n\n'
        '[settings]\nidiomatic_version_file_enable_tools = ["pnpm"]\n',
        encoding="utf-8",
    )

    bad_hash = "deadbeef" * 16  # 128 chars
    test_package_json = tmp_path / "package.json"
    test_package_json.write_text(
        json.dumps(
            {
                "name": "checksum-test",
                "packageManager": f"pnpm@11.17.0+sha512.{bad_hash}",
            }
        ),
        encoding="utf-8",
    )

    # Use isolated data/cache/config directories so mise performs fresh verification
    env = os.environ.copy()
    env["MISE_DATA_DIR"] = str(tmp_path / "data")
    env["MISE_CACHE_DIR"] = str(tmp_path / "cache")
    env["MISE_CONFIG_DIR"] = str(tmp_path / "config")
    env["MISE_STATE_DIR"] = str(tmp_path / "state")

    # Trust the temporary directory
    subprocess.run(
        [mise_bin, "trust", str(tmp_path)], env=env, check=True, capture_output=True
    )

    # Run mise install (with no arguments, reading from package.json) in the sandbox
    proc = subprocess.run(
        [mise_bin, "install"],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    # Must fail because of checksum mismatch
    assert proc.returncode != 0, (
        f"Expected mise install to fail on bad checksum, but succeeded: {proc.stdout}"
    )
    combined_output = proc.stdout + proc.stderr
    assert (
        "Checksum mismatch" in combined_output
        or "Expected: sha512:deadbeef" in combined_output
    ), f"Expected checksum mismatch error, got:\n{combined_output}"


def test_mise_install_locked_succeeds() -> None:
    mise_bin = _get_mise_bin()

    proc = subprocess.run(
        [mise_bin, "install", "--locked"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, (
        f"Expected mise install --locked to succeed, got:\n{proc.stderr}\n{proc.stdout}"
    )


def test_offline_corepack_free_resolution() -> None:
    mise_bin = _get_mise_bin()

    # Ensure preinstallation has completed via locked install
    subprocess.run(
        [mise_bin, "install", "--locked"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
    )

    # Verify mise which pnpm resolves directly to mise install directory, not Corepack
    which_proc = subprocess.run(
        [mise_bin, "which", "pnpm"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    pnpm_path = which_proc.stdout.strip()
    assert "corepack" not in pnpm_path.lower(), (
        f"pnpm path must not be a Corepack shim, got {pnpm_path}"
    )
    assert "/installs/pnpm/" in pnpm_path, (
        f"pnpm path must point to mise-managed install directory, got {pnpm_path}"
    )

    # Verify offline resolution: mise exec -- pnpm --version executes cleanly with MISE_OFFLINE=1
    env = os.environ.copy()
    env["MISE_OFFLINE"] = "1"
    exec_proc = subprocess.run(
        [mise_bin, "exec", "--", "pnpm", "--version"],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert exec_proc.returncode == 0, (
        f"Expected offline mise exec -- pnpm --version to succeed, got:\n{exec_proc.stderr}"
    )
    assert exec_proc.stdout.strip() == "11.17.0", (
        f"Expected pnpm version 11.17.0, got {exec_proc.stdout.strip()}"
    )


def test_python_and_ruff_version_alignment() -> None:
    """Verify python version in mise.toml aligns with ruff.toml target-version."""
    assert MISE_TOML_PATH.is_file(), f"expected {MISE_TOML_PATH} to exist"
    assert RUFF_TOML_PATH.is_file(), f"expected {RUFF_TOML_PATH} to exist"

    mise_data = tomllib.loads(MISE_TOML_PATH.read_text(encoding="utf-8"))
    ruff_data = tomllib.loads(RUFF_TOML_PATH.read_text(encoding="utf-8"))

    py_version = mise_data.get("tools", {}).get("python", "")
    assert py_version == "3.12.9", (
        f"expected python 3.12.9 in mise.toml, got {py_version!r}"
    )

    ruff_target = ruff_data.get("target-version", "")
    assert ruff_target == "py312", (
        f"expected target-version = 'py312' in ruff.toml, got {ruff_target!r}"
    )


def test_python_shebang_scripts_consistency() -> None:
    """Verify all executable python scripts in scripts/ use #!/usr/bin/env python3."""
    scripts_dir = REPO_ROOT / "scripts"
    py_files = sorted(scripts_dir.rglob("*.py"))
    assert py_files, "expected python scripts in scripts/"

    for py_file in py_files:
        # Ignore __init__.py and tests
        if py_file.name == "__init__.py" or "scripts/tests" in str(py_file):
            continue
        first_line = py_file.read_text(encoding="utf-8").splitlines()[0].strip()
        assert first_line == "#!/usr/bin/env python3", (
            f"expected #!/usr/bin/env python3 shebang in {py_file}, got {first_line!r}"
        )


def test_python_package_ownership_requirements() -> None:
    """Verify scripts/requirements.txt exists and explicitly declares workflow dependencies."""
    assert REQUIREMENTS_TXT_PATH.is_file(), f"expected {REQUIREMENTS_TXT_PATH} to exist"
    content = REQUIREMENTS_TXT_PATH.read_text(encoding="utf-8")
    assert "pytest==9.0.3" in content, (
        "scripts/requirements.txt must explicitly declare pinned pytest version"
    )


def test_check_pytest_wrapper_contract(tmp_path: Path) -> None:
    """Verify scripts/check-pytest.sh exists and outputs install hint on missing pytest."""
    assert CHECK_PYTEST_PATH.is_file(), f"expected {CHECK_PYTEST_PATH} to exist"
    assert os.access(CHECK_PYTEST_PATH, os.X_OK), (
        f"expected {CHECK_PYTEST_PATH} to be executable"
    )

    python_stub = tmp_path / "python3"
    python_stub.write_text("#!/bin/sh\nexit 1\n", encoding="utf-8")
    python_stub.chmod(0o755)

    # Use a controlled Python probe failure so an ambient pytest install cannot
    # enter the wrapper's success path and recursively launch this test suite.
    restricted_env = {
        "PATH": f"{tmp_path}:/usr/bin:/bin",
    }
    proc = subprocess.run(
        ["bash", str(CHECK_PYTEST_PATH)],
        cwd=REPO_ROOT,
        env=restricted_env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode != 0, (
        "check-pytest.sh must exit non-zero when pytest is absent"
    )
    assert "pytest is not installed for the selected Python runtime" in proc.stderr, (
        f"expected install hint in stderr, got:\n{proc.stderr}"
    )
    assert "mise exec -- python3 -m pip install" in proc.stderr

    wrapper = CHECK_PYTEST_PATH.read_text(encoding="utf-8")
    assert 'exec python3 -m pytest "$@"' in wrapper, (
        "check-pytest.sh must bind pytest to the selected python3 interpreter"
    )


def test_ci_installs_pytest_for_mise_python() -> None:
    """Verify CI binds pytest installation and execution to the pinned Python."""
    workflow = CI_WORKFLOW_PATH.read_text(encoding="utf-8")

    setup_mise = workflow.index("- name: Setup mise", workflow.index("linters:"))
    install_pytest = workflow.index(
        "python3 -m pip install -r scripts/requirements.txt"
    )
    run_pytest = workflow.index("python3 -m pytest scripts/tests/")

    assert setup_mise < install_pytest < run_pytest
    assert 'pipx install "pytest==' not in workflow


def test_offline_python_and_ruff_resolution() -> None:
    """Verify offline resolution for python3 and ruff via mise exec."""
    mise_bin = _get_mise_bin()

    env = os.environ.copy()
    env["MISE_OFFLINE"] = "1"

    py_proc = subprocess.run(
        [mise_bin, "exec", "--", "python3", "--version"],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert py_proc.returncode == 0, (
        f"Expected offline mise exec -- python3 --version to succeed, got:\n{py_proc.stderr}"
    )
    assert py_proc.stdout.strip() == "Python 3.12.9", (
        f"Expected Python 3.12.9, got {py_proc.stdout.strip()}"
    )

    ruff_proc = subprocess.run(
        [mise_bin, "exec", "--", "ruff", "--version"],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert ruff_proc.returncode == 0, (
        f"Expected offline mise exec -- ruff --version to succeed, got:\n{ruff_proc.stderr}"
    )
    assert ruff_proc.stdout.strip() == "ruff 0.15.1", (
        f"Expected ruff 0.15.1, got {ruff_proc.stdout.strip()}"
    )


def _read_mise_supabase_pin() -> str:
    """Return the exact Supabase CLI version pinned in mise.toml [tools]."""
    data = tomllib.loads(MISE_TOML_PATH.read_text(encoding="utf-8"))
    pin = data.get("tools", {}).get("supabase")
    assert isinstance(pin, str) and re.fullmatch(r"\d+\.\d+\.\d+", pin), (
        f"mise.toml must pin an exact supabase CLI version (X.Y.Z), got {pin!r}"
    )
    return pin


def _collect_setup_cli_versions(
    workflows_dir: Path | None = None,
) -> list[tuple[Path, int, str]]:
    """Find every `version:` bound to a `supabase/setup-cli` step across workflows.

    Returns (path, line_number, version) tuples. Auto-discovers all workflow
    files so a new job that adds a setup-cli block is covered without editing
    this test.

    The scan is bounded to the setup-cli step's own `with:` mapping: starting
    after the `uses: supabase/setup-cli` line it reads until the next step
    (`- ` list item) or a dedent out of the step's key level, and accepts only a
    `version:` nested inside that step's `with:` — so neither a *later* step's
    `version:` nor a `version:` under some other key (e.g. `env:`) of this step
    can be misattributed to an unpinned setup-cli. YAML is parsed by hand
    (indentation + step markers) rather than with a library because the
    script/test suite is deliberately stdlib-only.

    `workflows_dir` defaults to the repo's `.github/workflows`; the parameter
    exists so the regression tests can point it at a fixture.
    """
    if workflows_dir is None:
        workflows_dir = REPO_ROOT / ".github" / "workflows"
    version_re = re.compile(r"^\s*version:\s*['\"]?(\d+\.\d+\.\d+)['\"]?\s*$")
    found: list[tuple[Path, int, str]] = []
    for wf in sorted(workflows_dir.glob("*.y*ml")):
        lines = wf.read_text(encoding="utf-8").splitlines()
        for idx, line in enumerate(lines):
            if "uses: supabase/setup-cli" not in line:
                continue
            # Column of the `uses:` keyword; the step's sibling keys (`with:`,
            # `env:`, `name:`) sit at this column, their children deeper. Only a
            # `version:` nested inside this step's own `with:` mapping configures
            # the action — a `version:` under `env:` (or any other key) does not.
            uses_col = line.index("uses:")
            match_line: int | None = None
            match_version: str | None = None
            in_with = False
            with_child_col: int | None = None
            offset = 1
            while idx + offset < len(lines):
                nxt = lines[idx + offset]
                stripped = nxt.strip()
                if stripped and not stripped.startswith("#"):
                    indent = len(nxt) - len(nxt.lstrip())
                    if stripped.startswith("- ") or stripped == "-":
                        break  # next step in the sequence
                    if indent < uses_col:
                        break  # dedented out of this step's mapping
                    if indent == uses_col:
                        # A step-level key: entering `with:`, or leaving it for a
                        # sibling key (`env:`, `name:`, …).
                        in_with = stripped.startswith("with:")
                        with_child_col = None
                    elif in_with:
                        if with_child_col is None:
                            with_child_col = indent
                        if indent == with_child_col:
                            m = version_re.match(nxt)
                            if m:
                                match_line = idx + offset + 1
                                match_version = m.group(1)
                                break
                offset += 1
            if match_version is None or match_line is None:
                raise AssertionError(
                    f"{wf.name}:{idx + 1} uses supabase/setup-cli but the step "
                    "declares no `version:` of its own"
                )
            found.append((wf, match_line, match_version))
    return found


def test_ci_setup_cli_pins_match_mise() -> None:
    """CI's supabase/setup-cli blocks must mirror the single mise.toml pin.

    mise.toml is the source of truth for the approved Supabase CLI version
    (Mac, Bazzite, agent bootstrap). Until the mise-only CI lane (PP-h2ui.8)
    consumes it directly, the workflow setup-cli blocks carry a literal mirror
    of the same version; this test fails loudly on any drift so a partial bump
    (the classic "8 of 9 sites" mistake) cannot merge.
    """
    mise_pin = _read_mise_supabase_pin()
    pins = _collect_setup_cli_versions()
    assert pins, (
        "expected at least one supabase/setup-cli block in .github/workflows/; "
        "found none — did the CLI setup move without updating this contract?"
    )
    mismatched = [
        (str(p.relative_to(REPO_ROOT)), ln, v) for p, ln, v in pins if v != mise_pin
    ]
    assert not mismatched, (
        f"supabase/setup-cli version(s) must match the mise.toml pin {mise_pin!r}; "
        f"drifted sites: {mismatched}"
    )


def test_collect_setup_cli_versions_raises_on_versionless_block(tmp_path: Path) -> None:
    """A setup-cli block with no version (incl. at EOF) must raise, not be skipped.

    Regression guard for the drift check: an unpinned/default-CLI block cannot
    be allowed to slip through just because it sits near the end of a file.
    """
    wf = tmp_path / "unpinned.yaml"
    # `setup-cli` on the final line — the scan window immediately hits EOF.
    wf.write_text(
        "jobs:\n  x:\n    steps:\n      - uses: supabase/setup-cli\n",
        encoding="utf-8",
    )
    raised = False
    try:
        _collect_setup_cli_versions(workflows_dir=tmp_path)
    except AssertionError as exc:
        raised = True
        assert "no `version:`" in str(exc)
    assert raised, "expected a versionless setup-cli block to raise, but it was skipped"


def test_collect_setup_cli_versions_reads_versioned_fixture(tmp_path: Path) -> None:
    """A well-formed setup-cli block resolves to its pinned version."""
    wf = tmp_path / "pinned.yaml"
    wf.write_text(
        "jobs:\n  x:\n    steps:\n"
        "      - uses: supabase/setup-cli@v3\n"
        "        with:\n"
        "          version: 9.9.9\n",
        encoding="utf-8",
    )
    pins = _collect_setup_cli_versions(workflows_dir=tmp_path)
    assert [v for _, _, v in pins] == ["9.9.9"]


def test_collect_setup_cli_versions_ignores_later_steps_version(tmp_path: Path) -> None:
    """A later step's `version:` must not be attributed to an unpinned setup-cli.

    Regression guard: an unpinned `supabase/setup-cli` immediately followed by
    another action carrying `version: 2.115.0` must still raise — the scan is
    bounded to setup-cli's own step, so the neighbor's value can't stand in.
    """
    wf = tmp_path / "misattribution.yaml"
    wf.write_text(
        "jobs:\n  x:\n    steps:\n"
        "      - uses: supabase/setup-cli@v3\n"
        "      - uses: some/other-action@v1\n"
        "        with:\n"
        "          version: 2.115.0\n",
        encoding="utf-8",
    )
    raised = False
    try:
        _collect_setup_cli_versions(workflows_dir=tmp_path)
    except AssertionError as exc:
        raised = True
        assert "no `version:`" in str(exc)
    assert raised, (
        "expected an unpinned setup-cli to raise despite a neighbor's version:"
    )


def test_collect_setup_cli_versions_ignores_non_with_version(tmp_path: Path) -> None:
    """A `version:` outside the step's `with:` (e.g. under `env:`) must not count.

    Regression guard: only `with.version` configures setup-cli, so a step that
    carries a `version:` under another key but no `with.version` is unpinned and
    must raise.
    """
    wf = tmp_path / "env-version.yaml"
    wf.write_text(
        "jobs:\n  x:\n    steps:\n"
        "      - uses: supabase/setup-cli@v3\n"
        "        env:\n"
        "          version: 2.115.0\n",
        encoding="utf-8",
    )
    raised = False
    try:
        _collect_setup_cli_versions(workflows_dir=tmp_path)
    except AssertionError as exc:
        raised = True
        assert "no `version:`" in str(exc)
    assert raised, "expected a non-with version: to be rejected as unpinned"


def test_collect_setup_cli_versions_ignores_block_scalar_version(
    tmp_path: Path,
) -> None:
    """A version-looking line inside a block scalar is not a `with.version`."""
    wf = tmp_path / "block-scalar-version.yaml"
    wf.write_text(
        "jobs:\n  x:\n    steps:\n"
        "      - uses: supabase/setup-cli@v3\n"
        "        with:\n"
        "          config: |\n"
        "            version: 2.115.0\n",
        encoding="utf-8",
    )
    raised = False
    try:
        _collect_setup_cli_versions(workflows_dir=tmp_path)
    except AssertionError as exc:
        raised = True
        assert "no `version:`" in str(exc)
    assert raised, "expected a block-scalar version: to be rejected as unpinned"


def test_collect_setup_cli_versions_handles_name_form_step(tmp_path: Path) -> None:
    """The `- name:` step form (uses under the marker) resolves its own version."""
    wf = tmp_path / "name-form.yaml"
    wf.write_text(
        "jobs:\n  x:\n    steps:\n"
        "      - name: Setup Supabase CLI\n"
        "        uses: supabase/setup-cli@v3  # ratchet:...\n"
        "        with:\n"
        "          version: 1.2.3\n"
        "      - name: Next\n"
        "        uses: some/other@v1\n"
        "        with:\n"
        "          version: 9.9.9\n",
        encoding="utf-8",
    )
    pins = _collect_setup_cli_versions(workflows_dir=tmp_path)
    assert [v for _, _, v in pins] == ["1.2.3"]
