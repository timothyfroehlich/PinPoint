"""Tests for PinPoint cloud Beads compatibility and bootstrap integration.

Tests the vendored fresh-cloud compatibility snapshot, cloud setup/init scripts,
and fail-closed guard behaviors.
"""

import hashlib
import json
import os
import re
import shutil
import subprocess
import tarfile
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MANIFEST_PATH = REPO_ROOT / "scripts" / "beads-compatibility.json"
SETUP_SCRIPT = REPO_ROOT / "scripts" / "beads-cloud-setup.sh"
INIT_SCRIPT = REPO_ROOT / "scripts" / "beads-cloud-init.sh"


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
