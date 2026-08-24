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

MINIMUM_MISE_VERSION = (2026, 8, 11)


def _parse_mise_version(raw: str) -> tuple[int, ...]:
    """Extract (year, month, patch) tuple from mise version output."""
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)", raw.strip())
    if not match:
        raise ValueError(f"Could not parse mise version from {raw!r}")
    return tuple(int(x) for x in match.groups())


def test_mise_toml_exists_and_is_valid() -> None:
    assert MISE_TOML_PATH.is_file(), f"expected {MISE_TOML_PATH} to exist"
    data = tomllib.loads(MISE_TOML_PATH.read_text(encoding="utf-8"))

    # Node development runtime must be pinned
    tools = data.get("tools", {})
    assert "node" in tools, "mise.toml must specify node in [tools]"
    assert tools["node"] == "24.16.0", f"expected node 24.16.0, got {tools['node']!r}"

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


def test_mise_cli_version_meets_minimum() -> None:
    mise_bin = shutil.which("mise")
    if not mise_bin:
        return

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
    mise_bin = shutil.which("mise")
    if not mise_bin:
        return

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


def test_negative_checksum_mismatch_rejected(tmp_path: Path) -> None:
    mise_bin = shutil.which("mise")
    if not mise_bin:
        return

    # Create an isolated sandbox with mise.toml and a package.json with a bad sha512
    test_mise_toml = tmp_path / "mise.toml"
    test_mise_toml.write_text(
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
    mise_bin = shutil.which("mise")
    if not mise_bin:
        return

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
    mise_bin = shutil.which("mise")
    if not mise_bin:
        return

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
