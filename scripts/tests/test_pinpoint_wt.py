"""Unit tests for pinpoint-wt.py env merging functionality."""

import sys
from pathlib import Path

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pinpoint_wt_lib import (
    LOCAL_SUPABASE_PUBLISHABLE_KEY,
    LOCAL_SUPABASE_SERVICE_ROLE_KEY,
    MANAGED_ENV_KEYS,
    USER_PROVIDED_KEYS,
    PortConfig,
    branch_to_project_id,
    merge_env_local,
    parse_env_file,
)


class TestParseEnvFile:
    """Test env file parsing."""

    def test_parses_key_value_pairs(self, tmp_path: Path) -> None:
        """Test basic key=value parsing."""
        env_file = tmp_path / ".env.local"
        env_file.write_text("FOO=bar\nBAZ=qux\n")

        result = parse_env_file(env_file)

        assert result == {"FOO": "bar", "BAZ": "qux"}

    def test_ignores_comments(self, tmp_path: Path) -> None:
        """Test that comments are ignored."""
        env_file = tmp_path / ".env.local"
        env_file.write_text("# This is a comment\nFOO=bar\n# Another comment\n")

        result = parse_env_file(env_file)

        assert result == {"FOO": "bar"}

    def test_ignores_blank_lines(self, tmp_path: Path) -> None:
        """Test that blank lines are ignored."""
        env_file = tmp_path / ".env.local"
        env_file.write_text("FOO=bar\n\n\nBAZ=qux\n")

        result = parse_env_file(env_file)

        assert result == {"FOO": "bar", "BAZ": "qux"}

    def test_handles_values_with_equals(self, tmp_path: Path) -> None:
        """Test values containing = are preserved."""
        env_file = tmp_path / ".env.local"
        env_file.write_text("POSTGRES_URL=postgresql://user:pass@host:5432/db?sslmode=require\n")

        result = parse_env_file(env_file)

        assert result["POSTGRES_URL"] == "postgresql://user:pass@host:5432/db?sslmode=require"

    def test_strips_whitespace(self, tmp_path: Path) -> None:
        """Test that whitespace is stripped from keys and values."""
        env_file = tmp_path / ".env.local"
        env_file.write_text("  FOO  =  bar  \n")

        result = parse_env_file(env_file)

        assert result == {"FOO": "bar"}

    def test_empty_value(self, tmp_path: Path) -> None:
        """Test that empty values are preserved."""
        env_file = tmp_path / ".env.local"
        env_file.write_text("EMPTY_KEY=\n")

        result = parse_env_file(env_file)

        assert result == {"EMPTY_KEY": ""}


class TestMergeEnvLocal:
    """Test the merge_env_local function."""

    @pytest.fixture
    def port_config(self) -> PortConfig:
        """Create a test port configuration."""
        return PortConfig(
            name="test-worktree",
            nextjs_offset=400,
            supabase_offset=4000,
            project_id="pinpoint-test",
        )

    def test_overwrites_supabase_keys_with_static_values(
        self, tmp_path: Path, port_config: PortConfig
    ) -> None:
        """Test that Supabase keys are overwritten with static local dev values on sync."""
        env_file = tmp_path / ".env.local"
        env_file.write_text(
            "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321\n"
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=old-key\n"
            "SUPABASE_SERVICE_ROLE_KEY=old-role-key\n"
        )

        result = merge_env_local(tmp_path, port_config)

        # Should be overwritten with the static local dev values
        assert f"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY={LOCAL_SUPABASE_PUBLISHABLE_KEY}" in result
        assert f"SUPABASE_SERVICE_ROLE_KEY={LOCAL_SUPABASE_SERVICE_ROLE_KEY}" in result

    def test_updates_port_dependent_keys(self, tmp_path: Path, port_config: PortConfig) -> None:
        """Test that port-dependent keys are updated."""
        env_file = tmp_path / ".env.local"
        env_file.write_text(
            "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321\n"
            "PORT=3000\n"
            "POSTGRES_URL=postgresql://postgres:postgres@localhost:54322/postgres\n"
        )

        result = merge_env_local(tmp_path, port_config)

        # New API port = 54321 + 4000 = 58321
        assert "NEXT_PUBLIC_SUPABASE_URL=http://localhost:58321" in result
        # New Next.js port = 3000 + 400 = 3400
        assert "PORT=3400" in result
        # New DB port = 54322 + 4000 = 58322
        assert "POSTGRES_URL=postgresql://postgres:postgres@localhost:58322/postgres" in result
        assert "POSTGRES_URL_NON_POOLING=postgresql://postgres:postgres@localhost:58322/postgres" in result

    def test_preserves_custom_variables(self, tmp_path: Path, port_config: PortConfig) -> None:
        """Test that user-added custom variables are preserved."""
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
        """Test that a fresh .env.local has the static local Supabase keys."""
        # No existing .env.local file

        result = merge_env_local(tmp_path, port_config)

        # Should have the static local dev keys auto-populated
        assert f"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY={LOCAL_SUPABASE_PUBLISHABLE_KEY}" in result
        assert f"SUPABASE_SERVICE_ROLE_KEY={LOCAL_SUPABASE_SERVICE_ROLE_KEY}" in result
        # And managed values should be set
        assert "http://localhost:58321" in result

    def test_includes_header_comment(self, tmp_path: Path, port_config: PortConfig) -> None:
        """Test that the output includes the header explaining management."""
        result = merge_env_local(tmp_path, port_config)

        assert "PORTS MANAGED BY pinpoint-wt.py" in result
        assert "Other keys preserved" in result

    def test_includes_dev_autologin_defaults(
        self, tmp_path: Path, port_config: PortConfig
    ) -> None:
        """Test that dev autologin defaults are included."""
        result = merge_env_local(tmp_path, port_config)

        assert "DEV_AUTOLOGIN_ENABLED=true" in result
        assert "DEV_AUTOLOGIN_EMAIL=admin@test.com" in result
        assert "DEV_AUTOLOGIN_PASSWORD=TestPassword123" in result

    def test_email_config_uses_correct_ports(
        self, tmp_path: Path, port_config: PortConfig
    ) -> None:
        """Test that email configuration uses correct inbucket/smtp ports."""
        result = merge_env_local(tmp_path, port_config)

        # Inbucket port = 54324 + 4000 = 58324
        assert "INBUCKET_PORT=58324" in result
        assert "MAILPIT_PORT=58324" in result
        # SMTP port = 54325 + 4000 = 58325
        assert "INBUCKET_SMTP_PORT=58325" in result
        assert "MAILPIT_SMTP_PORT=58325" in result


class TestManagedAndUserKeys:
    """Test the key categorization constants."""

    def test_managed_keys_include_supabase_keys(self) -> None:
        """Test that managed keys include static Supabase keys."""
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
        }
        assert MANAGED_ENV_KEYS == expected_managed

    def test_user_provided_keys_is_empty(self) -> None:
        """Test that user-provided keys set is empty (all keys are now managed)."""
        assert USER_PROVIDED_KEYS == set()

    def test_no_overlap_between_managed_and_user(self) -> None:
        """Test that managed and user keys don't overlap."""
        overlap = MANAGED_ENV_KEYS & USER_PROVIDED_KEYS
        assert overlap == set(), f"Keys should not be both managed and user-provided: {overlap}"


class TestPortConfig:
    """Test PortConfig calculations."""

    def test_port_calculations(self) -> None:
        """Test that port offsets are applied correctly."""
        config = PortConfig(
            name="test",
            nextjs_offset=400,
            supabase_offset=4000,
            project_id="test",
        )

        assert config.nextjs_port == 3400  # 3000 + 400
        assert config.api_port == 58321  # 54321 + 4000
        assert config.db_port == 58322  # 54322 + 4000
        assert config.inbucket_port == 58324  # 54324 + 4000
        assert config.smtp_port == 58325  # 54325 + 4000
        assert config.site_url == "http://localhost:3400"


class TestBranchToProjectId:
    """Test branch name to project ID conversion."""

    def test_simple_branch_name(self) -> None:
        """Test simple branch names are converted correctly."""
        assert branch_to_project_id("my-feature") == "pinpoint-my-feature"

    def test_feature_branch_with_slash(self) -> None:
        """Test feature branches with slashes."""
        assert branch_to_project_id("feat/my-feature") == "pinpoint-feat-my-feature"

    def test_uppercase_is_lowercased(self) -> None:
        """Test uppercase characters are lowercased."""
        assert branch_to_project_id("Fix/MyBug") == "pinpoint-fix-mybug"

    def test_special_characters_replaced(self) -> None:
        """Test special characters are replaced with hyphens."""
        # Trailing special chars become hyphens, then get stripped
        assert branch_to_project_id("feat/add_new@feature!") == "pinpoint-feat-add-new-feature"

    def test_no_double_hyphens(self) -> None:
        """Test that double hyphens are collapsed (Copilot bug fix)."""
        # Branch starting with slash would create leading hyphen
        result = branch_to_project_id("/my-feature")
        assert "--" not in result
        assert result == "pinpoint-my-feature"

    def test_multiple_consecutive_special_chars(self) -> None:
        """Test multiple consecutive special characters become single hyphen."""
        assert branch_to_project_id("feat///multiple___chars") == "pinpoint-feat-multiple-chars"

    def test_long_branch_name_truncated(self) -> None:
        """Test very long branch names are truncated to 50 chars."""
        long_name = "a" * 100
        result = branch_to_project_id(long_name)
        assert len(result) <= 50

    def test_trailing_special_chars_stripped(self) -> None:
        """Test trailing special characters are stripped."""
        result = branch_to_project_id("my-feature///")
        assert not result.endswith("-")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
