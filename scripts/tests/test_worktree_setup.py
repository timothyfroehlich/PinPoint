"""Unit tests for worktree_setup.py env merging and port allocation."""

import sys
from pathlib import Path

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
    load_manifest,
    merge_env_local,
    parse_env_file,
    prune_manifest,
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
        assert config.site_url == "http://localhost:3010"

    def test_slot_40(self) -> None:
        config = PortConfig(slot=40, project_id="test", name="test")
        assert config.nextjs_port == 3400
        assert config.api_port == 58321
        assert config.db_port == 58322
        assert config.site_url == "http://localhost:3400"

    def test_slot_99(self) -> None:
        config = PortConfig(slot=99, project_id="test", name="test")
        assert config.nextjs_port == 3990
        assert config.api_port == 64221


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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
