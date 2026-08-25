"""Tests for PinPoint bd & Dolt compatibility contract and cloud/service integration.

Tests the machine-readable manifest at scripts/beads-compatibility.json,
version parsing across setup/init scripts, fail-closed guard behaviors,
and Bazzite systemd service unit template configuration.
"""

import json
import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MANIFEST_PATH = REPO_ROOT / "scripts" / "beads-compatibility.json"
SETUP_SCRIPT = REPO_ROOT / "scripts" / "beads-cloud-setup.sh"
INIT_SCRIPT = REPO_ROOT / "scripts" / "beads-cloud-init.sh"
DOLT_SERVICE = REPO_ROOT / "scripts" / "beads-server" / "dolt-sql-server.service"
BRIDGE_SERVICE = REPO_ROOT / "scripts" / "beads-server" / "beads-dolthub-bridge.service"
SETUP_MD = REPO_ROOT / "scripts" / "beads-server" / "SETUP.md"
RUNBOOK_MD = REPO_ROOT / "docs" / "runbooks" / "cloud-routines-beads-access.md"


class TestBeadsCompatibilityManifest:
    def test_manifest_exists_and_valid_json(self):
        assert MANIFEST_PATH.is_file(), f"Missing {MANIFEST_PATH}"
        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        assert "bd" in data, "Manifest missing 'bd' version key"
        assert "dolt" in data, "Manifest missing 'dolt' version key"

    def test_versions_are_exact_semver(self):
        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        semver_re = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")
        assert semver_re.match(data["bd"]), (
            f"bd version {data['bd']} is not exact semver"
        )
        assert semver_re.match(data["dolt"]), (
            f"dolt version {data['dolt']} is not exact semver"
        )


class TestVersionParsing:
    def test_setup_script_regex_extracts_versions(self):
        setup_content = SETUP_SCRIPT.read_text(encoding="utf-8")
        assert "beads-compatibility.json" in setup_content

        manifest_content = MANIFEST_PATH.read_text(encoding="utf-8")
        data = json.loads(manifest_content)

        # Emulate the shell sed expressions used in beads-cloud-setup.sh
        bd_match = re.search(
            r'^\s*"bd"\s*:\s*"([^"]+)"', manifest_content, re.MULTILINE
        )
        dolt_match = re.search(
            r'^\s*"dolt"\s*:\s*"([^"]+)"', manifest_content, re.MULTILINE
        )

        assert bd_match is not None, "Failed to match bd version in manifest"
        assert dolt_match is not None, "Failed to match dolt version in manifest"
        assert bd_match.group(1) == data["bd"]
        assert dolt_match.group(1) == data["dolt"]

    def test_init_script_regex_extracts_versions(self):
        init_content = INIT_SCRIPT.read_text(encoding="utf-8")
        assert "beads-compatibility.json" in init_content

        manifest_content = MANIFEST_PATH.read_text(encoding="utf-8")
        data = json.loads(manifest_content)

        bd_match = re.search(
            r'^\s*"bd"\s*:\s*"([^"]+)"', manifest_content, re.MULTILINE
        )
        dolt_match = re.search(
            r'^\s*"dolt"\s*:\s*"([^"]+)"', manifest_content, re.MULTILINE
        )

        assert bd_match is not None, "Failed to match bd version in manifest"
        assert dolt_match is not None, "Failed to match dolt version in manifest"
        assert bd_match.group(1) == data["bd"]
        assert dolt_match.group(1) == data["dolt"]


class TestCloudInitGuards:
    def test_guard_passes_with_matching_versions(self, tmp_path: Path):
        """Simulate beads-cloud-init version check logic with matching bd and dolt."""
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()

        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        bd_ver = data["bd"]
        dolt_ver = data["dolt"]

        # Fake bd and dolt binaries
        bd_bin = bin_dir / "bd"
        bd_bin.write_text(
            f"#!/bin/sh\necho 'bd version {bd_ver} (test)'\n", encoding="utf-8"
        )
        bd_bin.chmod(0o755)

        dolt_bin = bin_dir / "dolt"
        dolt_bin.write_text(
            f"#!/bin/sh\necho 'dolt version {dolt_ver}'\n", encoding="utf-8"
        )
        dolt_bin.chmod(0o755)

        env = {
            "PATH": f"{bin_dir}:/usr/bin:/bin",
            "HOME": str(tmp_path),
            "DOLT_CREDS_JWK": '{"fake":"key"}',
            "DOLT_CREDS_PUB": "fake_key",
            "BEADS_SYNC_REMOTE": "https://example.com/fake",
        }

        # Run bash test verifying version checks pass
        check_script = f"""
        set -euo pipefail
        bd_raw="$(bd version 2>&1 || true)"
        bd_parsed="$(printf '%s\\n' "$bd_raw" | sed -nE 's/^bd version ([0-9]+\\.[0-9]+\\.[0-9]+).*/\\1/p' | head -n1 || true)"
        [[ "$bd_parsed" == "{bd_ver}" ]]

        dolt_raw="$(dolt version 2>&1 || true)"
        dolt_parsed="$(printf '%s\\n' "$dolt_raw" | sed -nE 's/^dolt version ([0-9]+\\.[0-9]+\\.[0-9]+).*/\\1/p' | head -n1 || true)"
        [[ "$dolt_parsed" == "{dolt_ver}" ]]
        """
        proc = subprocess.run(
            ["bash", "-c", check_script], env=env, capture_output=True, text=True
        )
        assert proc.returncode == 0

    def test_guard_fails_with_mismatched_bd_version(self, tmp_path: Path):
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()

        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        bd_ver = data["bd"]

        # Fake bd binary with wrong version
        bd_bin = bin_dir / "bd"
        bd_bin.write_text("#!/bin/sh\necho 'bd version 9.9.9'\n", encoding="utf-8")
        bd_bin.chmod(0o755)

        env = {"PATH": f"{bin_dir}:/usr/bin:/bin"}
        check_script = f"""
        set -euo pipefail
        bd_raw="$(bd version 2>&1 || true)"
        bd_parsed="$(printf '%s\\n' "$bd_raw" | sed -nE 's/^bd version ([0-9]+\\.[0-9]+\\.[0-9]+).*/\\1/p' | head -n1 || true)"
        [[ "$bd_parsed" == "{bd_ver}" ]]
        """
        proc = subprocess.run(
            ["bash", "-c", check_script], env=env, capture_output=True, text=True
        )
        assert proc.returncode != 0

    def test_guard_fails_with_mismatched_dolt_version(self, tmp_path: Path):
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()

        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        dolt_ver = data["dolt"]

        # Fake dolt binary with wrong version
        dolt_bin = bin_dir / "dolt"
        dolt_bin.write_text("#!/bin/sh\necho 'dolt version 0.0.1'\n", encoding="utf-8")
        dolt_bin.chmod(0o755)

        env = {"PATH": f"{bin_dir}:/usr/bin:/bin"}
        check_script = f"""
        set -euo pipefail
        dolt_raw="$(dolt version 2>&1 || true)"
        dolt_parsed="$(printf '%s\\n' "$dolt_raw" | sed -nE 's/^dolt version ([0-9]+\\.[0-9]+\\.[0-9]+).*/\\1/p' | head -n1 || true)"
        [[ "$dolt_parsed" == "{dolt_ver}" ]]
        """
        proc = subprocess.run(
            ["bash", "-c", check_script], env=env, capture_output=True, text=True
        )
        assert proc.returncode != 0


DOLT_LAUNCHER = REPO_ROOT / "scripts" / "beads-server" / "dolt-sql-server.sh"
BRIDGE_SCRIPT = REPO_ROOT / "scripts" / "beads-server" / "beads-dolthub-bridge.sh"


class TestBazziteServiceTemplates:
    def test_dolt_service_uses_mise_exec_and_launcher(self):
        content = DOLT_SERVICE.read_text(encoding="utf-8")
        assert (
            "mise exec -- /usr/bin/bash %h/.beads-server/dolt-sql-server.sh" in content
        )
        assert "MISE_EXEC_AUTO_INSTALL=false" in content
        assert "MISE_NOT_FOUND_AUTO_INSTALL=false" in content
        assert "MISE_NOT_FOUND_SYSTEM_FALLBACK=false" in content
        assert "linuxbrew" not in content

    def test_bridge_service_uses_mise_exec(self):
        content = BRIDGE_SERVICE.read_text(encoding="utf-8")
        assert (
            "mise exec -- /usr/bin/bash %h/.beads-server/beads-dolthub-bridge.sh"
            in content
        )
        assert "MISE_EXEC_AUTO_INSTALL=false" in content
        assert "MISE_NOT_FOUND_AUTO_INSTALL=false" in content
        assert "MISE_NOT_FOUND_SYSTEM_FALLBACK=false" in content
        assert "linuxbrew" not in content


class TestBazziteServiceGuards:
    def test_dolt_launcher_validates_manifest(self, tmp_path: Path):
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()

        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        dolt_ver = data["dolt"]

        dolt_bin = bin_dir / "dolt"
        dolt_bin.write_text(
            f"#!/bin/sh\nif [ \"$1\" = 'version' ]; then echo 'dolt version {dolt_ver}'; exit 0; fi\necho \"server mock $@\"\n",
            encoding="utf-8",
        )
        dolt_bin.chmod(0o755)

        env = {
            "PATH": f"{bin_dir}:/usr/bin:/bin",
            "HOME": str(tmp_path),
            "PINPOINT_DIR": str(REPO_ROOT),
        }

        proc = subprocess.run(
            ["bash", str(DOLT_LAUNCHER), "--help"],
            env=env,
            capture_output=True,
            text=True,
        )
        assert proc.returncode == 0
        assert "matches compatibility contract" in proc.stderr

    def test_dolt_launcher_fails_on_version_mismatch(self, tmp_path: Path):
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()

        dolt_bin = bin_dir / "dolt"
        dolt_bin.write_text(
            "#!/bin/sh\necho 'dolt version 9.9.9'\n",
            encoding="utf-8",
        )
        dolt_bin.chmod(0o755)

        env = {
            "PATH": f"{bin_dir}:/usr/bin:/bin",
            "HOME": str(tmp_path),
            "PINPOINT_DIR": str(REPO_ROOT),
        }

        proc = subprocess.run(
            ["bash", str(DOLT_LAUNCHER), "--help"],
            env=env,
            capture_output=True,
            text=True,
        )
        assert proc.returncode != 0
        assert "refusing to start server" in proc.stderr

    def test_bridge_script_fails_on_bd_version_mismatch(self, tmp_path: Path):
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()

        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        dolt_ver = data["dolt"]

        bd_bin = bin_dir / "bd"
        bd_bin.write_text(
            "#!/bin/sh\necho 'bd version 0.0.1'\n",
            encoding="utf-8",
        )
        bd_bin.chmod(0o755)

        dolt_bin = bin_dir / "dolt"
        dolt_bin.write_text(
            f"#!/bin/sh\necho 'dolt version {dolt_ver}'\n",
            encoding="utf-8",
        )
        dolt_bin.chmod(0o755)

        env = {
            "PATH": f"{bin_dir}:/usr/bin:/bin",
            "HOME": str(tmp_path),
            "PINPOINT_DIR": str(REPO_ROOT),
            "BEADS_DOLT_PASSWORD": "dummy",
        }

        proc = subprocess.run(
            ["bash", str(BRIDGE_SCRIPT)],
            env=env,
            capture_output=True,
            text=True,
        )
        assert proc.returncode != 0
        assert "refusing bridge cycle" in proc.stderr


class TestDocumentationReferences:
    def test_setup_md_references_manifest(self):
        content = SETUP_MD.read_text(encoding="utf-8")
        assert "scripts/beads-compatibility.json" in content
        assert "mise exec -- dolt" in content
        assert "mise exec -- bd" in content
        assert "Disposable compatibility testing" in content

    def test_runbook_references_manifest(self):
        content = RUNBOOK_MD.read_text(encoding="utf-8")
        assert "scripts/beads-compatibility.json" in content
        assert "dolt" in content
        assert "bd" in content
