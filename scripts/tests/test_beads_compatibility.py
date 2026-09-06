"""Tests for PinPoint bd & Dolt compatibility contract and cloud/service integration.

Tests the machine-readable manifest at scripts/beads-compatibility.json,
version parsing across setup/init scripts, fail-closed guard behaviors,
and Bazzite systemd service unit template configuration.
"""

import hashlib
import json
import os
import re
import shutil
import subprocess
import tarfile
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

    def test_cloud_assets_have_approved_sha256_digests(self):
        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        cloud_assets = data["cloudAssets"]

        assert set(cloud_assets) == {"linux-amd64"}
        sha256_re = re.compile(r"^[0-9a-f]{64}$")
        assert sha256_re.fullmatch(cloud_assets["linux-amd64"]["bdSha256"])
        assert sha256_re.fullmatch(cloud_assets["linux-amd64"]["doltSha256"])


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


def write_executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(0o755)


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare_cloud_setup_harness(
    tmp_path: Path,
    *,
    corrupt_bd: bool = False,
    uname_s: str = "Linux",
    uname_m: str = "x86_64",
) -> tuple[Path, dict[str, str], Path, Path]:
    """Build deterministic local release archives and command-boundary stubs."""
    payload_dir = tmp_path / "payloads"
    payload_dir.mkdir()

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    bd_version = manifest["bd"]
    dolt_version = manifest["dolt"]

    dolt_payload = payload_dir / "dolt-linux-amd64" / "bin" / "dolt"
    dolt_payload.parent.mkdir(parents=True)
    write_executable(
        dolt_payload,
        f"#!/bin/sh\necho 'dolt version {dolt_version}'\n",
    )
    bd_payload = payload_dir / "bd"
    write_executable(
        bd_payload,
        f"#!/bin/sh\necho 'bd version {bd_version} (test)'\n",
    )

    dolt_archive = payload_dir / "dolt-linux-amd64.tar.gz"
    with tarfile.open(dolt_archive, "w:gz") as archive:
        archive.add(
            dolt_payload.parent.parent,
            arcname="dolt-linux-amd64",
        )

    bd_archive = payload_dir / f"beads_{bd_version}_linux_amd64.tar.gz"
    with tarfile.open(bd_archive, "w:gz") as archive:
        archive.add(bd_payload, arcname="bd")

    runtime_scripts = tmp_path / "runtime" / "scripts"
    runtime_scripts.mkdir(parents=True)
    runtime_setup = runtime_scripts / SETUP_SCRIPT.name
    shutil.copy2(SETUP_SCRIPT, runtime_setup)
    manifest["cloudAssets"]["linux-amd64"] = {
        "bdSha256": file_sha256(bd_archive),
        "doltSha256": file_sha256(dolt_archive),
    }
    (runtime_scripts / MANIFEST_PATH.name).write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )

    served_bd_archive = bd_archive
    if corrupt_bd:
        served_bd_archive = payload_dir / "corrupt-bd.tar.gz"
        served_bd_archive.write_bytes(bd_archive.read_bytes() + b"tampered")

    stub_dir = tmp_path / "stubs"
    stub_dir.mkdir()
    calls_file = tmp_path / "calls.log"
    write_executable(
        stub_dir / "uname",
        """#!/bin/sh
case "$1" in
  -s) printf '%s\\n' "$TEST_UNAME_S" ;;
  -m) printf '%s\\n' "$TEST_UNAME_M" ;;
  *) exit 91 ;;
esac
""",
    )
    write_executable(
        stub_dir / "curl",
        """#!/bin/sh
printf 'curl %s\\n' "$*" >> "$TEST_CALLS_FILE"
output=''
url=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) shift; output="$1" ;;
    https://*) url="$1" ;;
  esac
  shift
done
case "$url" in
  *dolt-linux-amd64.tar.gz) cp "$TEST_DOLT_ARCHIVE" "$output" ;;
  *beads_*_linux_amd64.tar.gz) cp "$TEST_BD_ARCHIVE" "$output" ;;
  *) exit 92 ;;
esac
""",
    )
    real_tar = shutil.which("tar")
    assert real_tar is not None
    write_executable(
        stub_dir / "tar",
        f"""#!/bin/sh
printf 'tar %s\\n' "$*" >> "$TEST_CALLS_FILE"
exec {real_tar} "$@"
""",
    )
    write_executable(
        stub_dir / "install",
        """#!/bin/sh
printf 'install %s\\n' "$*" >> "$TEST_CALLS_FILE"
cp "$1" "$2"
chmod 755 "$2"
""",
    )

    install_dir = tmp_path / "installed"
    install_dir.mkdir()
    work_parent = tmp_path / "work"
    work_parent.mkdir()
    env = {
        **os.environ,
        "PATH": f"{stub_dir}:{os.environ['PATH']}",
        "BEADS_CLOUD_BIN_DIR": str(install_dir),
        "TMPDIR": str(work_parent),
        "TEST_BD_ARCHIVE": str(served_bd_archive),
        "TEST_DOLT_ARCHIVE": str(dolt_archive),
        "TEST_CALLS_FILE": str(calls_file),
        "TEST_UNAME_S": uname_s,
        "TEST_UNAME_M": uname_m,
    }
    return runtime_setup, env, install_dir, calls_file


class TestCloudSetupVerification:
    def test_verified_archives_install_and_temporary_files_are_cleaned(
        self, tmp_path: Path
    ):
        setup_script, env, install_dir, calls_file = prepare_cloud_setup_harness(
            tmp_path
        )

        proc = subprocess.run(
            ["bash", str(setup_script)], env=env, capture_output=True, text=True
        )

        assert proc.returncode == 0, proc.stderr
        assert (install_dir / "bd").is_file()
        assert (install_dir / "dolt").is_file()
        assert list((tmp_path / "work").iterdir()) == []
        calls = calls_file.read_text(encoding="utf-8").splitlines()
        assert sum(call.startswith("curl ") for call in calls) == 2
        assert sum(call.startswith("tar ") for call in calls) == 2
        assert sum(call.startswith("install ") for call in calls) == 2

    def test_bd_digest_mismatch_extracts_and_installs_nothing(self, tmp_path: Path):
        setup_script, env, install_dir, calls_file = prepare_cloud_setup_harness(
            tmp_path, corrupt_bd=True
        )

        proc = subprocess.run(
            ["bash", str(setup_script)], env=env, capture_output=True, text=True
        )

        assert proc.returncode != 0
        assert "SHA-256 mismatch for bd.tgz" in proc.stderr
        assert list(install_dir.iterdir()) == []
        assert list((tmp_path / "work").iterdir()) == []
        calls = calls_file.read_text(encoding="utf-8").splitlines()
        assert all(not call.startswith(("tar ", "install ")) for call in calls)

    def test_undeclared_platform_fails_before_download_or_install(self, tmp_path: Path):
        setup_script, env, install_dir, calls_file = prepare_cloud_setup_harness(
            tmp_path, uname_s="Linux", uname_m="riscv64"
        )

        proc = subprocess.run(
            ["bash", str(setup_script)], env=env, capture_output=True, text=True
        )

        assert proc.returncode != 0
        assert "unsupported cloud platform Linux/riscv64" in proc.stderr
        assert list(install_dir.iterdir()) == []
        assert not calls_file.exists()


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


def run_bridge_pull_conflict(
    tmp_path: Path, *, conflict_state: str
) -> tuple[subprocess.CompletedProcess[str], list[str]]:
    """Run one bridge conflict cycle against deterministic bd/dolt stubs."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls_file = tmp_path / "dolt-calls"
    state_file = tmp_path / "dolt-state"

    data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    bd_bin = bin_dir / "bd"
    bd_bin.write_text(
        f"""#!/bin/sh
case "$*" in
  version) echo 'bd version {data["bd"]} (test)' ;;
  'dolt commit') exit 0 ;;
  'dolt pull') echo 'merge conflicts in issues require operator resolution' >&2; exit 1 ;;
  *) echo "unexpected bd call: $*" >&2; exit 88 ;;
esac
""",
        encoding="utf-8",
    )
    bd_bin.chmod(0o755)

    dolt_bin = bin_dir / "dolt"
    dolt_bin.write_text(
        f"""#!/bin/sh
if [ "$1" = version ]; then
  echo 'dolt version {data["dolt"]}'
  exit 0
fi
printf '%s\\n' "$*" >> "$DOLT_CALLS_FILE"
if printf '%s' "$*" | grep -q 'is_merging'; then
  printf 'is_merging\\n'
  if [ "$DOLT_TEST_CONFLICT_STATE" = clean ] || [ -f "$DOLT_STATE_FILE" ]; then
    printf '0\\n'
  else
    printf '1\\n'
  fi
elif printf '%s' "$*" | grep -q 'DOLT_MERGE'; then
  touch "$DOLT_STATE_FILE"
else
  echo "unexpected dolt call: $*" >&2
  exit 89
fi
""",
        encoding="utf-8",
    )
    dolt_bin.chmod(0o755)

    env = {
        "PATH": f"{bin_dir}:/usr/bin:/bin",
        "HOME": str(tmp_path),
        "PINPOINT_DIR": str(REPO_ROOT),
        "BEADS_DOLT_PASSWORD": "dummy",
        "BEADS_SERVER_HOST": "test-host",
        "BEADS_SERVER_PORT": "13306",
        "BEADS_SERVER_USER": "test-user",
        "BEADS_DB": "PP",
        "DOLT_CALLS_FILE": str(calls_file),
        "DOLT_STATE_FILE": str(state_file),
        "DOLT_TEST_CONFLICT_STATE": conflict_state,
    }
    proc = subprocess.run(
        ["bash", str(BRIDGE_SCRIPT)], env=env, capture_output=True, text=True
    )
    calls = calls_file.read_text(encoding="utf-8").splitlines()
    return proc, calls


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

    def test_bridge_conflict_recovery_uses_remote_dolt_connection_flags(
        self, tmp_path: Path
    ):
        """Connection flags belong to the root `dolt` command, before `sql`."""
        proc, calls = run_bridge_pull_conflict(tmp_path, conflict_state="clean")

        assert proc.returncode != 0
        assert calls
        assert all(
            call.startswith(
                "--host test-host --port 13306 --user test-user "
                "--password dummy --no-tls --use-db PP sql "
            )
            for call in calls
        )

    def test_bridge_skips_abort_when_pull_already_restored_conflicts(
        self, tmp_path: Path
    ):
        proc, calls = run_bridge_pull_conflict(tmp_path, conflict_state="clean")

        assert proc.returncode != 0
        assert any("is_merging" in call for call in calls)
        assert all("DOLT_MERGE" not in call for call in calls)
        assert "no merge remains active" in proc.stderr

    def test_bridge_aborts_and_verifies_a_schema_only_conflict(self, tmp_path: Path):
        proc, calls = run_bridge_pull_conflict(tmp_path, conflict_state="active")

        assert proc.returncode != 0
        assert sum("is_merging" in call for call in calls) == 2
        assert sum("DOLT_MERGE" in call for call in calls) == 1
        assert "merge aborted; no merge remains active" in proc.stderr


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
