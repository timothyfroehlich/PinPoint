"""Tests for scripts/dev-stop.sh against real process trees.

Each test builds a throwaway git worktree and starts a Node process tree shaped
like `pnpm run dev`: a launcher titled `pnpm run dev`, the `next dev` CLI at
node_modules/next/dist/bin/next, the `next-server (vX)` child that listens on
the worktree's PORT, and a worker under that server.
"""

import os
import shutil
import signal
import socket
import subprocess
import time
from collections.abc import Iterator
from pathlib import Path

import pytest

SCRIPT_PATH = Path(__file__).parent.parent / "dev-stop.sh"

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None
    or (shutil.which("lsof") is None and shutil.which("ss") is None),
    reason="needs node and lsof or ss",
)

LAUNCHER_JS = """
process.title = process.env.FAKE_LAUNCHER_TITLE;
const { spawn } = require("child_process");
const path = require("path");
const cli = path.join(process.env.FAKE_ROOT, "node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [cli, "dev", "--port", process.env.PORT], {
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
"""

NEXT_CLI_JS = """
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
fs.writeFileSync(path.join(process.env.FAKE_PIDS, "cli"), String(process.pid));
const server = path.join(process.env.FAKE_ROOT, "fake/server.js");
spawn(process.execPath, [server], { stdio: "inherit" });
setInterval(() => {}, 1000);
"""

SERVER_JS = """
process.title = "next-server (v0.0.0-test)";
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");
if (process.env.FAKE_IGNORE_TERM === "1") process.on("SIGTERM", () => {});
const worker = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
  stdio: "inherit",
});
fs.writeFileSync(path.join(process.env.FAKE_PIDS, "server"), String(process.pid));
fs.writeFileSync(path.join(process.env.FAKE_PIDS, "worker"), String(worker.pid));
net.createServer().listen(Number(process.env.PORT));
"""


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    stat = subprocess.run(
        ["ps", "-o", "stat=", "-p", str(pid)],
        capture_output=True,
        text=True,
        check=False,
    ).stdout.strip()
    return bool(stat) and not stat.startswith("Z")


def _listening(port: int) -> bool:
    with socket.socket() as sock:
        return sock.connect_ex(("127.0.0.1", port)) == 0


class Worktree:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.port = _free_port()
        self.pids_dir = self.root / "pids"
        self.procs: list[subprocess.Popen[bytes]] = []

        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        (self.root / ".env.local").write_text(
            f"NEXT_PUBLIC_SUPABASE_URL=http://localhost:1\nPORT={self.port}\n"
        )
        cli = self.root / "node_modules/next/dist/bin/next"
        cli.parent.mkdir(parents=True)
        cli.write_text(NEXT_CLI_JS)
        fake = self.root / "fake"
        fake.mkdir()
        (fake / "launcher.js").write_text(LAUNCHER_JS)
        (fake / "server.js").write_text(SERVER_JS)
        self.pids_dir.mkdir()

    def start(
        self,
        *,
        cwd: Path | None = None,
        launcher_title: str = "pnpm run dev",
        ignore_term: bool = False,
    ) -> dict[str, int]:
        env = os.environ.copy()
        env.update(
            FAKE_ROOT=str(self.root),
            FAKE_PIDS=str(self.pids_dir),
            FAKE_LAUNCHER_TITLE=launcher_title,
            FAKE_IGNORE_TERM="1" if ignore_term else "0",
            PORT=str(self.port),
        )
        proc = subprocess.Popen(
            ["node", str(self.root / "fake/launcher.js")],
            cwd=cwd or self.root,
            env=env,
        )
        self.procs.append(proc)
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            names = {"cli", "server", "worker"}
            if names <= {p.name for p in self.pids_dir.iterdir()} and _listening(
                self.port
            ):
                pids = {n: int((self.pids_dir / n).read_text()) for n in names}
                pids["launcher"] = proc.pid
                return pids
            time.sleep(0.05)
        raise AssertionError("fake dev server never started listening")

    def stop(
        self, *args: str, cwd: Path | None = None
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(SCRIPT_PATH), *args],
            cwd=cwd or self.root,
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )

    def cleanup(self) -> None:
        pids = [
            int(p.read_text()) for p in self.pids_dir.iterdir() if p.read_text()
        ] + [proc.pid for proc in self.procs]
        for pid in pids:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        for proc in self.procs:
            proc.wait(timeout=5)


@pytest.fixture
def worktree(tmp_path: Path) -> Iterator[Worktree]:
    wt = Worktree(tmp_path / "wt")
    try:
        yield wt
    finally:
        wt.cleanup()


def _wait_dead(pids: list[int], timeout: float = 5) -> list[int]:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not any(_alive(pid) for pid in pids):
            return []
        time.sleep(0.05)
    return [pid for pid in pids if _alive(pid)]


def test_stops_the_whole_dev_tree(worktree: Worktree) -> None:
    pids = worktree.start()

    result = worktree.stop()

    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout.startswith("PASS: dev stop — stopped 4 process(es)")
    assert _wait_dead(list(pids.values())) == []
    assert not _listening(worktree.port)


def test_escalates_to_sigkill_and_leaves_no_orphaned_server(
    worktree: Worktree,
) -> None:
    pids = worktree.start(ignore_term=True)

    result = worktree.stop("--timeout=1")

    assert result.returncode == 0, result.stdout + result.stderr
    assert "needed SIGKILL" in result.stdout
    assert _wait_dead(list(pids.values())) == []


def test_does_not_climb_into_a_shell_that_only_mentions_the_dev_command(
    worktree: Worktree,
) -> None:
    pids = worktree.start(launcher_title="zsh -c pnpm run dev && echo done")

    dry_run = worktree.stop("--dry-run")
    result = worktree.stop()

    assert f"  {pids['launcher']}  " not in dry_run.stdout
    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout.startswith("PASS: dev stop — stopped 3 process(es)")
    assert _wait_dead([pids["cli"], pids["server"], pids["worker"]]) == []


def test_refuses_a_listener_from_a_nested_worktree(worktree: Worktree) -> None:
    nested = worktree.root / ".claude/worktrees/nested"
    nested.mkdir(parents=True)
    pids = worktree.start(cwd=nested)

    result = worktree.stop()

    assert result.returncode == 1
    assert "refusing" in result.stdout and "not this worktree" in result.stdout
    assert all(_alive(pid) for pid in pids.values())


def test_refuses_a_listener_that_is_not_nextjs(worktree: Worktree) -> None:
    proc = subprocess.Popen(
        ["python3", "-m", "http.server", str(worktree.port), "--bind", "127.0.0.1"],
        cwd=worktree.root,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    worktree.procs.append(proc)
    deadline = time.monotonic() + 10
    while not _listening(worktree.port) and time.monotonic() < deadline:
        time.sleep(0.05)

    result = worktree.stop()

    assert result.returncode == 1
    assert "not a Next.js server" in result.stdout
    assert _alive(proc.pid)


def test_dry_run_lists_the_tree_without_signaling(worktree: Worktree) -> None:
    pids = worktree.start()

    result = worktree.stop("--dry-run")

    assert result.returncode == 0, result.stdout + result.stderr
    assert "would signal 4 process(es)" in result.stdout
    for pid in pids.values():
        assert f"  {pid}  " in result.stdout
        assert _alive(pid)


def test_nothing_listening_is_a_pass(worktree: Worktree) -> None:
    result = worktree.stop()

    assert result.returncode == 0
    assert result.stdout.startswith("PASS: dev stop — nothing listening")


def test_rejects_unknown_arguments(worktree: Worktree) -> None:
    result = worktree.stop("--all")

    assert result.returncode == 2
