"""Unit tests for the Supabase secret-staging SELinux labeler (PP-9mg0).

The script is a no-op off SELinux, so every branch is exercised through stub
binaries rather than through a real policy. PATH is replaced outright (not
prepended) so the results are identical on an SELinux host and in CI --
otherwise the "SELinux tooling absent" case would find the real
/usr/bin/selinuxenabled on Bazzite and take the opposite branch.
"""

import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT_PATH = (
    Path(__file__).parent.parent / "selinux-label-supabase-secrets.sh"
).resolve()

WRONG_LABEL = "system_u:object_r:user_home_t:s0"
RIGHT_LABEL = "system_u:object_r:container_file_t:s0"
# What `:Z` leaves behind: the right type, but private MCS categories only one
# container can read. Must still be corrected.
PRIVATE_LABEL = "system_u:object_r:container_file_t:s0:c435,c938"

# Real tools the script needs once it gets past the SELinux guard. `git` is not
# among them: the tests pass the repo root as $1, so the fallback never runs.
PASSTHROUGH = ("mkdir", "awk")


@pytest.fixture
def env(tmp_path: Path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    for tool in PASSTHROUGH:
        real = shutil.which(tool)
        assert real is not None, f"{tool} not found on PATH"
        (bin_dir / tool).symlink_to(real)

    root = tmp_path / "repo"
    (root / "supabase").mkdir(parents=True)
    chcon_log = tmp_path / "chcon_calls.txt"

    def stub(name: str, body: str) -> None:
        path = bin_dir / name
        path.write_text(f"#!/bin/bash\n{body}\n")
        path.chmod(0o755)

    bash = shutil.which("bash")
    assert bash is not None

    def run() -> subprocess.CompletedProcess[str]:
        # Absolute bash: PATH is replaced, so the interpreter cannot be resolved
        # through it.
        return subprocess.run(
            [bash, str(SCRIPT_PATH), str(root)],
            capture_output=True,
            text=True,
            env={"PATH": str(bin_dir)},
        )

    def enable_selinux(label: str) -> None:
        stub("selinuxenabled", "exit 0")
        stub("chcon", f'echo "$@" >> {chcon_log}\nexit 0')
        real_ls = shutil.which("ls")
        stub(
            "ls",
            f'if [ "$1" = "-Zd" ]; then echo "{label} $2"; exit 0; fi\n'
            f'exec {real_ls} "$@"',
        )

    return {
        "root": root,
        "target": root / "supabase" / ".temp" / "start-secrets",
        "chcon_log": chcon_log,
        "stub": stub,
        "run": run,
        "enable_selinux": enable_selinux,
    }


def test_noop_when_selinux_tooling_absent(env):
    """macOS and CI have no selinuxenabled at all -- exit 0, touch nothing."""
    result = env["run"]()

    assert result.returncode == 0, result.stderr
    assert not env["target"].exists()


def test_noop_when_selinux_disabled(env):
    """Tooling present but the policy is off -- exit 0, touch nothing."""
    env["stub"]("selinuxenabled", "exit 1")

    result = env["run"]()

    assert result.returncode == 0, result.stderr
    assert not env["target"].exists()


def test_creates_and_labels_staging_dir(env):
    """The dir must exist and be labeled *before* the CLI stages a key in it."""
    env["enable_selinux"](WRONG_LABEL)

    result = env["run"]()

    assert result.returncode == 0, result.stderr
    assert env["target"].is_dir()
    assert (
        f"-R -t container_file_t -l s0 {env['target']}" in env["chcon_log"].read_text()
    )


def test_relabels_private_mcs_categories(env):
    """`:Z` leaves container_file_t with categories -- still unreadable."""
    env["enable_selinux"](PRIVATE_LABEL)

    result = env["run"]()

    assert result.returncode == 0, result.stderr
    assert "-l s0" in env["chcon_log"].read_text()


def test_idempotent_when_already_labeled(env):
    """Runs on every post-checkout and every db:_restart -- must stay silent."""
    env["enable_selinux"](RIGHT_LABEL)

    result = env["run"]()

    assert result.returncode == 0, result.stderr
    assert not env["chcon_log"].exists()
    assert result.stdout == ""


def test_warns_but_succeeds_when_chcon_fails(env):
    """Best-effort: a labeling failure must not break checkout or db:_restart."""
    env["enable_selinux"](WRONG_LABEL)
    env["stub"]("chcon", "exit 1")

    result = env["run"]()

    assert result.returncode == 0
    assert "invalid secret key" in result.stderr
    assert "PP-9mg0" in result.stderr
