"""Unit tests for worktree_setup.py env merging and port allocation."""

import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from worktree_setup import (
    LOCAL_SUPABASE_PUBLISHABLE_KEY,
    LOCAL_SUPABASE_SERVICE_ROLE_KEY,
    MANAGED_ENV_KEYS,
    PortConfig,
    allocate_slot,
    branch_to_project_id,
    configure_branch_tracking,
    generate_launch_json,
    get_current_upstream,
    load_manifest,
    merge_env_local,
    parse_env_file,
    prune_manifest,
    resolve_brainstorm_server_path,
    save_manifest,
)


class TestParseEnvFile:
    """Test env file parsing."""

    def test_parses_key_value_pairs(self, tmp_path: Path) -> None:
        env_file = tmp_path / ".env.local"
        env_file.write_text("FOO=bar\nBAZ=qux\n")

        result = parse_env_file(env_file)

        assert result == {"FOO": "bar", "BAZ": "qux"}

    def test_ignores_comments(self, tmp_path: Path) -> None:
        env_file = tmp_path / ".env.local"
        env_file.write_text("# This is a comment\nFOO=bar\n# Another comment\n")

        result = parse_env_file(env_file)

        assert result == {"FOO": "bar"}

    def test_ignores_blank_lines(self, tmp_path: Path) -> None:
        env_file = tmp_path / ".env.local"
        env_file.write_text("FOO=bar\n\n\nBAZ=qux\n")

        result = parse_env_file(env_file)

        assert result == {"FOO": "bar", "BAZ": "qux"}

    def test_handles_values_with_equals(self, tmp_path: Path) -> None:
        env_file = tmp_path / ".env.local"
        env_file.write_text(
            "POSTGRES_URL=postgresql://user:pass@host:5432/db?sslmode=require\n"
        )

        result = parse_env_file(env_file)

        assert (
            result["POSTGRES_URL"]
            == "postgresql://user:pass@host:5432/db?sslmode=require"
        )

    def test_strips_whitespace(self, tmp_path: Path) -> None:
        env_file = tmp_path / ".env.local"
        env_file.write_text("  FOO  =  bar  \n")

        result = parse_env_file(env_file)

        assert result == {"FOO": "bar"}

    def test_empty_value(self, tmp_path: Path) -> None:
        env_file = tmp_path / ".env.local"
        env_file.write_text("EMPTY_KEY=\n")

        result = parse_env_file(env_file)

        assert result == {"EMPTY_KEY": ""}


class TestMergeEnvLocal:
    """Test the merge_env_local function."""

    @pytest.fixture
    def port_config(self) -> PortConfig:
        return PortConfig(slot=40, project_id="pinpoint-test", name="test-worktree")

    def test_overwrites_supabase_keys_with_static_values(
        self, tmp_path: Path, port_config: PortConfig
    ) -> None:
        env_file = tmp_path / ".env.local"
        env_file.write_text(
            "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321\n"
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=old-key\n"
            "SUPABASE_SERVICE_ROLE_KEY=old-role-key\n"
        )

        result = merge_env_local(tmp_path, port_config)

        assert (
            f"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY={LOCAL_SUPABASE_PUBLISHABLE_KEY}"
            in result
        )
        assert f"SUPABASE_SERVICE_ROLE_KEY={LOCAL_SUPABASE_SERVICE_ROLE_KEY}" in result

    def test_updates_port_dependent_keys(
        self, tmp_path: Path, port_config: PortConfig
    ) -> None:
        env_file = tmp_path / ".env.local"
        env_file.write_text(
            "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321\n"
            "PORT=3000\n"
            "POSTGRES_URL=postgresql://postgres:postgres@localhost:54322/postgres\n"
        )

        result = merge_env_local(tmp_path, port_config)

        # slot 40: API = 54321 + 4000 = 58321, Next.js = 3000 + 400 = 3400, DB = 54322 + 4000 = 58322
        assert "NEXT_PUBLIC_SUPABASE_URL=http://localhost:58321" in result
        assert "PORT=3400" in result
        assert (
            "POSTGRES_URL=postgresql://postgres:postgres@localhost:58322/postgres"
            in result
        )
        assert (
            "POSTGRES_URL_NON_POOLING=postgresql://postgres:postgres@localhost:58322/postgres"
            in result
        )

    def test_preserves_custom_variables(
        self, tmp_path: Path, port_config: PortConfig
    ) -> None:
        env_file = tmp_path / ".env.local"
        env_file.write_text(
            "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321\n"
            "MY_CUSTOM_VAR=custom_value\n"
            "ANOTHER_CUSTOM=another_value\n"
        )

        result = merge_env_local(tmp_path, port_config)

        assert "MY_CUSTOM_VAR=custom_value" in result
        assert "ANOTHER_CUSTOM=another_value" in result

    def test_fresh_file_has_static_supabase_keys(
        self, tmp_path: Path, port_config: PortConfig
    ) -> None:
        result = merge_env_local(tmp_path, port_config)

        assert (
            f"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY={LOCAL_SUPABASE_PUBLISHABLE_KEY}"
            in result
        )
        assert f"SUPABASE_SERVICE_ROLE_KEY={LOCAL_SUPABASE_SERVICE_ROLE_KEY}" in result
        assert "http://localhost:58321" in result

    def test_includes_header_comment(
        self, tmp_path: Path, port_config: PortConfig
    ) -> None:
        result = merge_env_local(tmp_path, port_config)

        assert "PORTS MANAGED BY worktree_setup.py" in result
        assert "other keys preserved" in result

    def test_includes_dev_autologin_defaults(
        self, tmp_path: Path, port_config: PortConfig
    ) -> None:
        result = merge_env_local(tmp_path, port_config)

        assert "DEV_AUTOLOGIN_ENABLED=true" in result
        assert "DEV_AUTOLOGIN_EMAIL=admin@test.com" in result
        assert "DEV_AUTOLOGIN_PASSWORD=TestPassword123" in result

    def test_email_config_uses_correct_ports(
        self, tmp_path: Path, port_config: PortConfig
    ) -> None:
        result = merge_env_local(tmp_path, port_config)

        # slot 40: inbucket = 54324 + 4000 = 58324, smtp = 54325 + 4000 = 58325
        assert "INBUCKET_PORT=58324" in result
        assert "MAILPIT_PORT=58324" in result
        assert "INBUCKET_SMTP_PORT=58325" in result
        assert "MAILPIT_SMTP_PORT=58325" in result


class TestManagedKeys:
    """Test the managed key set."""

    def test_managed_keys_complete(self) -> None:
        expected_managed = {
            "NEXT_PUBLIC_SUPABASE_URL",
            "POSTGRES_URL",
            "POSTGRES_URL_NON_POOLING",
            "PORT",
            "NEXT_PUBLIC_SITE_URL",
            "EMAIL_TRANSPORT",
            "MAILPIT_PORT",
            "MAILPIT_SMTP_PORT",
            "INBUCKET_PORT",
            "INBUCKET_SMTP_PORT",
            "DEV_AUTOLOGIN_ENABLED",
            "DEV_AUTOLOGIN_EMAIL",
            "DEV_AUTOLOGIN_PASSWORD",
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
            "TURNSTILE_SECRET_KEY",
        }
        assert MANAGED_ENV_KEYS == expected_managed


class TestPortConfig:
    """Test PortConfig slot-based calculations."""

    def test_slot_1(self) -> None:
        config = PortConfig(slot=1, project_id="test", name="test")
        assert config.nextjs_port == 3010
        assert config.api_port == 54421
        assert config.db_port == 54422
        assert config.shadow_port == 54420
        assert config.pooler_port == 54429
        assert config.inbucket_port == 54424
        assert config.smtp_port == 54425
        assert config.pop3_port == 54426
        assert config.brainstorm_port == 49001
        assert config.site_url == "http://localhost:3010"

    def test_slot_40(self) -> None:
        config = PortConfig(slot=40, project_id="test", name="test")
        assert config.nextjs_port == 3400
        assert config.api_port == 58321
        assert config.db_port == 58322
        assert config.site_url == "http://localhost:3400"

    def test_slot_96_max(self) -> None:
        config = PortConfig(slot=96, project_id="test", name="test")
        assert config.nextjs_port == 3960
        assert config.api_port == 63921
        # All ports stay within the 54xxx-63xxx range expected by integration tests
        assert config.inbucket_port == 63924


class TestBrainstormPort:
    """Test brainstorm port allocation per slot."""

    @pytest.mark.parametrize("slot", [1, 19, 96])
    def test_brainstorm_port_formula(self, slot: int) -> None:
        config = PortConfig(slot=slot, project_id="test", name="test")
        assert config.brainstorm_port == 49000 + slot

    def test_port_config_has_brainstorm_attribute(self) -> None:
        config = PortConfig(slot=5, project_id="test", name="test")
        # PortConfig exposes a brainstorm_port accessor.
        assert hasattr(config, "brainstorm_port")
        assert isinstance(config.brainstorm_port, int)


class TestResolveBrainstormServerPath:
    """Test resolve_brainstorm_server_path() version selection logic."""

    def _make_version_dir(self, plugin_root: Path, version: str) -> None:
        """Create the directory tree for a given plugin version."""
        script = (
            plugin_root
            / version
            / "skills"
            / "brainstorming"
            / "scripts"
            / "start-server.sh"
        )
        script.parent.mkdir(parents=True, exist_ok=True)
        script.write_text("#!/bin/bash\n")

    def test_selects_highest_numeric_version(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        plugin_root = tmp_path / "superpowers"
        for version in ["1.0.0", "2.0.0", "1.10.0"]:
            self._make_version_dir(plugin_root, version)

        monkeypatch.setattr("worktree_setup.Path.home", lambda: tmp_path / "home")
        # Patch the glob call by monkeypatching the plugin_root construction.
        # Instead, import the function and patch via a fake home directory.
        # We rebuild the expected plugin_root path structure.
        home = tmp_path / "home"
        real_plugin_root = (
            home
            / ".claude"
            / "plugins"
            / "cache"
            / "claude-plugins-official"
            / "superpowers"
        )
        for version in ["1.0.0", "2.0.0", "1.10.0"]:
            script = (
                real_plugin_root
                / version
                / "skills"
                / "brainstorming"
                / "scripts"
                / "start-server.sh"
            )
            script.parent.mkdir(parents=True, exist_ok=True)
            script.write_text("#!/bin/bash\n")

        result = resolve_brainstorm_server_path()

        assert result is not None
        # 2.0.0 > 1.10.0 > 1.0.0 numerically
        assert "/2.0.0/" in result

    def test_numeric_beats_non_numeric_segment(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        home = tmp_path / "home"
        real_plugin_root = (
            home
            / ".claude"
            / "plugins"
            / "cache"
            / "claude-plugins-official"
            / "superpowers"
        )
        # "1.0.0" has all-numeric segments; "1.0.0-beta" has a non-numeric part
        for version in ["1.0.0", "1.0.0-beta"]:
            script = (
                real_plugin_root
                / version
                / "skills"
                / "brainstorming"
                / "scripts"
                / "start-server.sh"
            )
            script.parent.mkdir(parents=True, exist_ok=True)
            script.write_text("#!/bin/bash\n")

        monkeypatch.setattr("worktree_setup.Path.home", lambda: home)

        result = resolve_brainstorm_server_path()

        assert result is not None
        # Non-numeric segment sorts as -1, so "1.0.0-beta" < "1.0.0"
        assert "/1.0.0/" in result
        assert "beta" not in result

    def test_returns_none_when_no_install(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        home = tmp_path / "home"
        monkeypatch.setattr("worktree_setup.Path.home", lambda: home)

        result = resolve_brainstorm_server_path()

        assert result is None


class TestGenerateLaunchJson:
    """Test .claude/launch.json generation with optional brainstorm entry."""

    @pytest.fixture
    def port_config(self) -> PortConfig:
        return PortConfig(slot=7, project_id="pinpoint-test", name="test-worktree")

    def _read_launch(self, worktree_path: Path) -> dict[str, object]:
        return json.loads((worktree_path / ".claude" / "launch.json").read_text())

    def test_includes_brainstorm_when_resolver_returns_path(
        self,
        tmp_path: Path,
        port_config: PortConfig,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        resolved = "/fake/plugins/superpowers/9.9.9/skills/brainstorming/scripts/start-server.sh"
        monkeypatch.setattr(
            "worktree_setup.resolve_brainstorm_server_path", lambda: resolved
        )

        generate_launch_json(tmp_path, port_config)
        data = self._read_launch(tmp_path)

        configs = data["configurations"]
        assert isinstance(configs, list)
        names = [c["name"] for c in configs]
        assert names == ["next-dev", "brainstorm"]

        brainstorm = next(c for c in configs if c["name"] == "brainstorm")
        # slot 7 → 49007
        assert brainstorm["port"] == 49007
        assert brainstorm["port"] == port_config.brainstorm_port
        assert brainstorm["runtimeExecutable"] == "bash"

        runtime_args = brainstorm["runtimeArgs"]
        assert runtime_args[0] == "-c"
        assert resolved in runtime_args[1]
        assert "BRAINSTORM_PORT=49007" in runtime_args[1]
        assert '--project-dir "$PWD"' in runtime_args[1]
        assert "--foreground" in runtime_args[1]

    def test_omits_brainstorm_when_resolver_returns_none(
        self,
        tmp_path: Path,
        port_config: PortConfig,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            "worktree_setup.resolve_brainstorm_server_path", lambda: None
        )

        generate_launch_json(tmp_path, port_config)
        data = self._read_launch(tmp_path)

        configs = data["configurations"]
        assert isinstance(configs, list)
        names = [c["name"] for c in configs]
        assert names == ["next-dev"]
        assert all(c["name"] != "brainstorm" for c in configs)


class TestManifest:
    """Test manifest load/save/prune/allocate."""

    @pytest.fixture(autouse=True)
    def _use_tmp_manifest(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Redirect MANIFEST_PATH to a temp directory for each test."""
        self.manifest_path = tmp_path / "worktree-slots.json"
        monkeypatch.setattr("worktree_setup.MANIFEST_PATH", self.manifest_path)

    def test_load_creates_file_if_missing(self) -> None:
        assert not self.manifest_path.exists()
        slots = load_manifest()
        assert slots == {}
        assert self.manifest_path.exists()

    def test_save_and_load_roundtrip(self) -> None:
        save_manifest({"/tmp/wt-a": 3, "/tmp/wt-b": 7})
        slots = load_manifest()
        assert slots == {"/tmp/wt-a": 3, "/tmp/wt-b": 7}

    def test_prune_removes_nonexistent_paths(self, tmp_path: Path) -> None:
        existing_dir = tmp_path / "exists"
        existing_dir.mkdir()
        slots = {str(existing_dir): 1, "/nonexistent/path": 2}
        pruned = prune_manifest(slots)
        assert pruned == {str(existing_dir): 1}

    def test_allocate_assigns_lowest_free_slot(self, tmp_path: Path) -> None:
        wt1 = tmp_path / "wt1"
        wt1.mkdir()
        wt2 = tmp_path / "wt2"
        wt2.mkdir()

        slot1 = allocate_slot(str(wt1))
        slot2 = allocate_slot(str(wt2))

        assert slot1 == 1
        assert slot2 == 2

    def test_allocate_reuses_freed_slots(self, tmp_path: Path) -> None:
        wt1 = tmp_path / "wt1"
        wt1.mkdir()
        wt2 = tmp_path / "wt2"
        wt2.mkdir()

        allocate_slot(str(wt1))
        allocate_slot(str(wt2))

        # Remove wt1 directory — prune will free slot 1
        wt1.rmdir()

        wt3 = tmp_path / "wt3"
        wt3.mkdir()
        slot3 = allocate_slot(str(wt3))
        assert slot3 == 1  # Reuses the freed slot

    def test_allocate_returns_existing_slot(self, tmp_path: Path) -> None:
        wt = tmp_path / "wt"
        wt.mkdir()

        slot1 = allocate_slot(str(wt))
        slot2 = allocate_slot(str(wt))

        assert slot1 == slot2  # Same worktree gets same slot


class TestBranchToProjectId:
    """Test branch name to project ID conversion."""

    def test_simple_branch_name(self) -> None:
        assert branch_to_project_id("my-feature") == "pinpoint-my-feature"

    def test_feature_branch_with_slash(self) -> None:
        assert branch_to_project_id("feat/my-feature") == "pinpoint-feat-my-feature"

    def test_uppercase_is_lowercased(self) -> None:
        assert branch_to_project_id("Fix/MyBug") == "pinpoint-fix-mybug"

    def test_special_characters_replaced(self) -> None:
        assert (
            branch_to_project_id("feat/add_new@feature!")
            == "pinpoint-feat-add-new-feature"
        )

    def test_no_double_hyphens(self) -> None:
        result = branch_to_project_id("/my-feature")
        assert "--" not in result
        assert result == "pinpoint-my-feature"

    def test_multiple_consecutive_special_chars(self) -> None:
        assert (
            branch_to_project_id("feat///multiple___chars")
            == "pinpoint-feat-multiple-chars"
        )

    def test_long_branch_name_truncated(self) -> None:
        long_name = "a" * 100
        result = branch_to_project_id(long_name)
        assert len(result) <= 50

    def test_trailing_special_chars_stripped(self) -> None:
        result = branch_to_project_id("my-feature///")
        assert not result.endswith("-")


class TestConfigureBranchTracking:
    """Unit tests for configure_branch_tracking() and get_current_upstream()."""

    # ---------------------------------------------------------------------------
    # Helpers
    # ---------------------------------------------------------------------------

    def _make_completed(
        self,
        returncode: int = 0,
        stdout: str = "",
        stderr: str = "",
    ) -> MagicMock:
        """Build a fake CompletedProcess-like object."""
        m = MagicMock()
        m.returncode = returncode
        m.stdout = stdout
        m.stderr = stderr
        return m

    # ---------------------------------------------------------------------------
    # get_current_upstream
    # ---------------------------------------------------------------------------

    def test_get_current_upstream_returns_ref_on_success(
        self, tmp_path: Path
    ) -> None:
        with patch("worktree_setup.subprocess.run") as mock_run:
            mock_run.return_value = self._make_completed(
                returncode=0, stdout="origin/main\n"
            )
            result = get_current_upstream("my-branch", tmp_path)
        assert result == "origin/main"

    def test_get_current_upstream_returns_none_on_failure(
        self, tmp_path: Path
    ) -> None:
        with patch("worktree_setup.subprocess.run") as mock_run:
            mock_run.return_value = self._make_completed(returncode=128, stdout="")
            result = get_current_upstream("my-branch", tmp_path)
        assert result is None

    def test_get_current_upstream_returns_none_for_empty_output(
        self, tmp_path: Path
    ) -> None:
        with patch("worktree_setup.subprocess.run") as mock_run:
            mock_run.return_value = self._make_completed(returncode=0, stdout="")
            result = get_current_upstream("my-branch", tmp_path)
        assert result is None

    # ---------------------------------------------------------------------------
    # configure_branch_tracking: no-op cases
    # ---------------------------------------------------------------------------

    def test_main_branch_is_skipped(self, tmp_path: Path) -> None:
        with patch("worktree_setup.subprocess.run") as mock_run:
            configure_branch_tracking("main", tmp_path)
        mock_run.assert_not_called()

    def test_master_branch_is_skipped(self, tmp_path: Path) -> None:
        with patch("worktree_setup.subprocess.run") as mock_run:
            configure_branch_tracking("master", tmp_path)
        mock_run.assert_not_called()

    def test_head_is_skipped(self, tmp_path: Path) -> None:
        with patch("worktree_setup.subprocess.run") as mock_run:
            configure_branch_tracking("HEAD", tmp_path)
        mock_run.assert_not_called()

    def test_custom_upstream_is_preserved(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """Branch with a non-origin/main, non-origin/<branch> upstream is left alone."""
        with patch("worktree_setup.subprocess.run") as mock_run:
            # get_current_upstream returns a custom upstream
            mock_run.return_value = self._make_completed(
                returncode=0, stdout="upstream/feat/x\n"
            )
            configure_branch_tracking("feat/my-feature", tmp_path)
        # Only one git call: the @{u} lookup — no set-upstream
        assert mock_run.call_count == 1

    def test_already_correct_upstream_is_silent(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """Branch already tracking origin/<branch>: no further git calls."""
        with patch("worktree_setup.subprocess.run") as mock_run:
            # get_current_upstream returns correct upstream
            mock_run.return_value = self._make_completed(
                returncode=0, stdout="origin/feat/my-feature\n"
            )
            configure_branch_tracking("feat/my-feature", tmp_path)
        # Only one git call: the @{u} lookup, then remote_check, then early return
        # (remote exists but upstream is already correct → no set-upstream call)
        set_upstream_calls = [
            c
            for c in mock_run.call_args_list
            if "--set-upstream-to" in str(c)
        ]
        assert len(set_upstream_calls) == 0

    # ---------------------------------------------------------------------------
    # configure_branch_tracking: upstream repair cases
    # ---------------------------------------------------------------------------

    def test_no_remote_prints_reminder(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """Branch with no origin remote → prints push reminder, no set-upstream."""

        def side_effect(args: list[str], **kwargs: object) -> MagicMock:
            if "@{u}" in " ".join(args):
                # get_current_upstream → unset
                return self._make_completed(returncode=128)
            # rev-parse --verify → remote does not exist
            return self._make_completed(returncode=128)

        with patch("worktree_setup.subprocess.run", side_effect=side_effect):
            configure_branch_tracking("feat/no-remote", tmp_path)

        _, err = capsys.readouterr()
        assert "git push -u origin feat/no-remote" in err
        assert "--set-upstream-to" not in err

    def test_stale_origin_main_upstream_is_replaced(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """Branch whose upstream is still origin/main gets updated to origin/<branch>."""

        def side_effect(args: list[str], **kwargs: object) -> MagicMock:
            cmd = " ".join(args)
            if "@{u}" in cmd:
                # get_current_upstream → stale
                return self._make_completed(returncode=0, stdout="origin/main\n")
            if "refs/remotes/origin" in cmd:
                # remote exists
                return self._make_completed(returncode=0, stdout="abc123\n")
            # set-upstream
            return self._make_completed(returncode=0)

        with patch("worktree_setup.subprocess.run", side_effect=side_effect):
            configure_branch_tracking("feat/my-feature", tmp_path)

        _, err = capsys.readouterr()
        assert "tracks origin/feat/my-feature" in err

    def test_no_upstream_set_is_repaired(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """Branch with no upstream configured gets set to origin/<branch>."""

        def side_effect(args: list[str], **kwargs: object) -> MagicMock:
            cmd = " ".join(args)
            if "@{u}" in cmd:
                return self._make_completed(returncode=128)  # no upstream
            if "refs/remotes/origin" in cmd:
                return self._make_completed(returncode=0, stdout="abc123\n")
            return self._make_completed(returncode=0)

        with patch("worktree_setup.subprocess.run", side_effect=side_effect):
            configure_branch_tracking("feat/new-branch", tmp_path)

        _, err = capsys.readouterr()
        assert "tracks origin/feat/new-branch" in err

    def test_subprocess_failure_on_set_upstream_warns(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """A failing git branch --set-upstream-to emits a warning and does not crash."""

        def side_effect(args: list[str], **kwargs: object) -> MagicMock:
            cmd = " ".join(args)
            if "@{u}" in cmd:
                return self._make_completed(returncode=128)  # no upstream
            if "refs/remotes/origin" in cmd:
                return self._make_completed(returncode=0, stdout="abc123\n")
            # set-upstream fails
            return self._make_completed(returncode=1, stderr="fatal: error")

        with patch("worktree_setup.subprocess.run", side_effect=side_effect):
            configure_branch_tracking("feat/failing-branch", tmp_path)

        _, err = capsys.readouterr()
        assert "warning" in err.lower()
        assert "feat/failing-branch" in err


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
