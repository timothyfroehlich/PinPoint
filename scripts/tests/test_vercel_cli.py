"""Tests for the pinned Vercel CLI wrapper and preview caller bindings (PP-h2ui.7).

Acceptance criteria:
- Every privileged Vercel CLI invocation uses one reviewed exact version and no
  caller resolves latest at runtime.
- Preview creation and destruction default to the pinned vercel-cli.sh wrapper.
- Production deployment retains `migrate:production && next build` without mise coupling.
"""

import json
import os
import re
import stat
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
VERCEL_WRAPPER = REPO_ROOT / "scripts" / "workflow" / "preview" / "vercel-cli.sh"
PREVIEW_CREATE = REPO_ROOT / "scripts" / "workflow" / "preview" / "preview-create.sh"
PREVIEW_DESTROY = REPO_ROOT / "scripts" / "workflow" / "preview" / "preview-destroy.sh"
PACKAGE_JSON = REPO_ROOT / "package.json"
THIS_FILE = Path(__file__).resolve()


def _get_pinned_vercel_version() -> str:
    content = VERCEL_WRAPPER.read_text(encoding="utf-8")
    match = re.search(r'VERCEL_CLI_VERSION="([^"]+)"', content)
    assert match is not None, "Failed to parse VERCEL_CLI_VERSION from vercel-cli.sh"
    version = match.group(1)
    assert re.match(r"^\d+\.\d+\.\d+$", version), (
        f"Invalid semver '{version}' in vercel-cli.sh"
    )
    return version


def test_vercel_cli_wrapper_exists_and_is_executable() -> None:
    assert VERCEL_WRAPPER.is_file(), f"Missing wrapper at {VERCEL_WRAPPER}"
    mode = VERCEL_WRAPPER.stat().st_mode
    assert bool(mode & stat.S_IXUSR), f"{VERCEL_WRAPPER} is not executable"


def test_vercel_cli_wrapper_pins_exact_version() -> None:
    content = VERCEL_WRAPPER.read_text(encoding="utf-8")
    assert "vercel@" + "latest" not in content
    version = _get_pinned_vercel_version()
    assert version


def test_vercel_cli_wrapper_ignores_ambient_version_override(tmp_path: Path) -> None:
    version = _get_pinned_vercel_version()
    mock_npx = tmp_path / "npx"
    log_file = tmp_path / "npx.log"
    mock_npx.write_text(
        f"""#!/usr/bin/env bash
echo "$@" >> "{log_file}"
""",
        encoding="utf-8",
    )
    mock_npx.chmod(0o755)

    env = os.environ.copy()
    env["PATH"] = f"{tmp_path}:{env.get('PATH', '')}"
    env["VERCEL_CLI_VERSION"] = "latest"

    result = subprocess.run(
        [str(VERCEL_WRAPPER), "--version"],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert result.returncode == 0, f"Wrapper failed: {result.stderr}"

    log_content = log_file.read_text(encoding="utf-8")
    assert f"--yes vercel@{version} --version" in log_content
    assert "latest" not in log_content


def test_vercel_cli_wrapper_execution_with_mock_npx(tmp_path: Path) -> None:
    version = _get_pinned_vercel_version()
    mock_npx = tmp_path / "npx"
    log_file = tmp_path / "npx.log"
    mock_npx.write_text(
        f"""#!/usr/bin/env bash
echo "$@" >> "{log_file}"
cat >> "{log_file}"
""",
        encoding="utf-8",
    )
    mock_npx.chmod(0o755)

    env = os.environ.copy()
    env["PATH"] = f"{tmp_path}:{env.get('PATH', '')}"

    result = subprocess.run(
        [str(VERCEL_WRAPPER), "env", "add", "FOO", "preview", "feat/branch", "--force"],
        input="secret_value",
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )
    assert result.returncode == 0, f"Wrapper failed: {result.stderr}"

    log_content = log_file.read_text(encoding="utf-8")
    assert (
        f"--yes vercel@{version} env add FOO preview feat/branch --force" in log_content
    )
    assert "secret_value" in log_content


def test_preview_scripts_use_pinned_wrapper() -> None:
    target_substr = "vercel@" + "latest"
    for script in (PREVIEW_CREATE, PREVIEW_DESTROY):
        content = script.read_text(encoding="utf-8")
        assert target_substr not in content, f"{script} still contains vercel@latest"
        assert 'VERCEL="${HERE}/vercel-cli.sh"' in content, (
            f"{script} does not bind VERCEL unconditionally to vercel-cli.sh"
        )
        assert "${VERCEL:-" not in content, (
            f"{script} still contains ambient VERCEL override"
        )


def test_no_floating_vercel_references_in_repo() -> None:
    # Walk repository files and ensure no active script/workflow uses vercel@latest
    target_substr = "vercel@" + "latest"
    patterns = ["*.sh", "*.yaml", "*.yml", "*.ts", "*.mjs", "*.py"]
    for pattern in patterns:
        for path in REPO_ROOT.glob(f"**/{pattern}"):
            if (
                "node_modules" in path.parts
                or ".git" in path.parts
                or ".dolt" in path.parts
                or path.resolve() == THIS_FILE
            ):
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            assert target_substr not in text, f"Found {target_substr} in {path}"


def test_package_json_vercel_build_contract() -> None:
    pkg = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    scripts = pkg.get("scripts", {})
    assert scripts.get("vercel-build") == "pnpm run migrate:production && next build"
    assert "mise" not in scripts.get("vercel-build", "")
    assert scripts.get("migrate:production") == "tsx scripts/migrate-production.ts"
