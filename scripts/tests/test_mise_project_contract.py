"""Tests for the PinPoint mise project contract (PP-h2ui.4).

Verifies that:
1. mise.toml defines the exact development Node runtime and settings.
2. package.json#packageManager remains the single pnpm version and checksum authority.
3. mise.toml does not duplicate the pnpm version (idiomatic_version_file_enable_tools is used).
4. mise.lock exists and captures resolved artifacts across platforms.
5. mise rejects mismatched packageManager checksum suffixes (negative test).
6. mise meets the minimum version requirement (>= 2026.8.11).
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

    # Node, Python, and Ruff development runtime must be pinned
    tools = data.get("tools", {})
    assert "node" in tools, "mise.toml must specify node in [tools]"
    assert tools["node"] == "24.16.0", f"expected node 24.16.0, got {tools['node']!r}"
    assert "python" in tools, "mise.toml must specify python in [tools]"
    assert tools["python"] == "3.12.9", (
        f"expected python 3.12.9, got {tools['python']!r}"
    )
    assert "ruff" in tools, "mise.toml must specify ruff in [tools]"
    assert tools["ruff"] == "0.15.1", f"expected ruff 0.15.1, got {tools['ruff']!r}"

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

    node_info = tools_dict["node"]
    node_source = (
        node_info[0]["source"]["path"]
        if isinstance(node_info, list)
        else node_info["source"]["path"]
    )
    assert str(node_source).endswith("mise.toml"), (
        f"node source should be mise.toml, got {node_source}"
    )

    pnpm_info = tools_dict["pnpm"]
    pnpm_source = (
        pnpm_info[0]["source"]["path"]
        if isinstance(pnpm_info, list)
        else pnpm_info["source"]["path"]
    )
    assert str(pnpm_source).endswith("package.json"), (
        f"pnpm source should be package.json, got {pnpm_source}"
    )

    python_info = tools_dict["python"]
    python_source = (
        python_info[0]["source"]["path"]
        if isinstance(python_info, list)
        else python_info["source"]["path"]
    )
    assert str(python_source).endswith("mise.toml"), (
        f"python source should be mise.toml, got {python_source}"
    )

    ruff_info = tools_dict["ruff"]
    ruff_source = (
        ruff_info[0]["source"]["path"]
        if isinstance(ruff_info, list)
        else ruff_info["source"]["path"]
    )
    assert str(ruff_source).endswith("mise.toml"), (
        f"ruff source should be mise.toml, got {ruff_source}"
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
                "packageManager": f"pnpm@11.11.0+sha512.{bad_hash}",
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
    assert exec_proc.stdout.strip() == "11.11.0", (
        f"Expected pnpm version 11.11.0, got {exec_proc.stdout.strip()}"
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
