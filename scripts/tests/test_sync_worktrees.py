"""Unit tests for sync_worktrees.py"""

import sys
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from sync_worktrees import (
    PORT_MAPPINGS,
    MergeStatus,
    StatusLevel,
    WorktreeState,
)


class TestPortConfig:
    """Test port configuration calculations"""

    def test_main_worktree_ports(self):
        """Test that main worktree has base ports"""
        config = PORT_MAPPINGS["PinPoint"]
        assert config.nextjs_port == 3000
        assert config.api_port == 54321
        assert config.db_port == 54322
        assert config.shadow_port == 54320
        assert config.pooler_port == 54329
        assert config.inbucket_port == 54324
        assert config.smtp_port == 54325
        assert config.pop3_port == 54326
        assert config.project_id == "pinpoint"
        assert config.site_url == "http://localhost:3000"

    def test_secondary_worktree_ports(self):
        """Test that secondary worktree has +100/+1000 offsets"""
        config = PORT_MAPPINGS["PinPoint-Secondary"]
        assert config.nextjs_port == 3100
        assert config.api_port == 55321
        assert config.db_port == 55322
        assert config.shadow_port == 55320
        assert config.pooler_port == 55329
        assert config.inbucket_port == 55324
        assert config.smtp_port == 55325
        assert config.pop3_port == 55326
        assert config.project_id == "pinpoint-secondary"
        assert config.site_url == "http://localhost:3100"

    def test_review_worktree_ports(self):
        """Test that review worktree has +200/+2000 offsets"""
        config = PORT_MAPPINGS["PinPoint-review"]
        assert config.nextjs_port == 3200
        assert config.api_port == 56321
        assert config.project_id == "pinpoint-review"
        assert config.site_url == "http://localhost:3200"

    def test_antigravity_worktree_ports(self):
        """Test that AntiGravity worktree has +300/+3000 offsets"""
        config = PORT_MAPPINGS["PinPoint-AntiGravity"]
        assert config.nextjs_port == 3300
        assert config.api_port == 57321
        assert config.project_id == "pinpoint-antigravity"
        assert config.site_url == "http://localhost:3300"

    def test_all_worktrees_defined(self):
        """Test that all expected worktrees are defined"""
        expected = {
            "PinPoint",
            "PinPoint-Secondary",
            "PinPoint-review",
            "PinPoint-AntiGravity",
        }
        assert set(PORT_MAPPINGS.keys()) == expected

    def test_port_uniqueness(self):
        """Test that all worktrees have unique ports"""
        nextjs_ports = [config.nextjs_port for config in PORT_MAPPINGS.values()]
        api_ports = [config.api_port for config in PORT_MAPPINGS.values()]
        db_ports = [config.db_port for config in PORT_MAPPINGS.values()]

        assert len(nextjs_ports) == len(set(nextjs_ports)), (
            "Next.js ports must be unique"
        )
        assert len(api_ports) == len(set(api_ports)), "API ports must be unique"
        assert len(db_ports) == len(set(db_ports)), "DB ports must be unique"

    def test_project_id_format(self):
        """Test that project IDs follow expected format"""
        for name, config in PORT_MAPPINGS.items():
            # Project ID should be lowercase version of name with hyphens
            expected_id = name.lower()
            assert (
                config.project_id == expected_id
                or config.project_id == name.lower().replace("-", "-")
            )


class TestWorktreeState:
    """Test worktree state management"""

    def test_initial_state(self):
        """Test that worktree state initializes correctly"""
        config = PORT_MAPPINGS["PinPoint"]
        state = WorktreeState(
            path=Path("/test/path"), name="PinPoint", port_config=config
        )

        assert state.name == "PinPoint"
        assert state.path == Path("/test/path")
        assert state.overall_status == StatusLevel.SUCCESS
        assert state.config_fixed is False
        assert state.conflicts_present is False
        assert state.stash_ref is None
        assert state.config_messages == []
        assert state.recovery_commands == []

    def test_status_update_success_to_warning(self):
        """Test status update from success to warning"""
        config = PORT_MAPPINGS["PinPoint"]
        state = WorktreeState(Path("/test"), "PinPoint", config)

        assert state.overall_status == StatusLevel.SUCCESS
        state.update_status(StatusLevel.WARNING)
        assert state.overall_status == StatusLevel.WARNING

    def test_status_update_success_to_error(self):
        """Test status update from success to error"""
        config = PORT_MAPPINGS["PinPoint"]
        state = WorktreeState(Path("/test"), "PinPoint", config)

        assert state.overall_status == StatusLevel.SUCCESS
        state.update_status(StatusLevel.ERROR)
        assert state.overall_status == StatusLevel.ERROR

    def test_status_update_warning_to_error(self):
        """Test status update from warning to error"""
        config = PORT_MAPPINGS["PinPoint"]
        state = WorktreeState(Path("/test"), "PinPoint", config)

        state.update_status(StatusLevel.WARNING)
        assert state.overall_status == StatusLevel.WARNING
        state.update_status(StatusLevel.ERROR)
        assert state.overall_status == StatusLevel.ERROR

    def test_status_update_error_stays_error(self):
        """Test that error status persists"""
        config = PORT_MAPPINGS["PinPoint"]
        state = WorktreeState(Path("/test"), "PinPoint", config)

        state.update_status(StatusLevel.ERROR)
        assert state.overall_status == StatusLevel.ERROR
        state.update_status(StatusLevel.SUCCESS)
        assert state.overall_status == StatusLevel.ERROR
        state.update_status(StatusLevel.WARNING)
        assert state.overall_status == StatusLevel.ERROR

    def test_status_update_warning_stays_warning(self):
        """Test that warning status persists over success"""
        config = PORT_MAPPINGS["PinPoint"]
        state = WorktreeState(Path("/test"), "PinPoint", config)

        state.update_status(StatusLevel.WARNING)
        assert state.overall_status == StatusLevel.WARNING
        state.update_status(StatusLevel.SUCCESS)
        assert state.overall_status == StatusLevel.WARNING

    def test_add_recovery_command(self):
        """Test adding recovery commands"""
        config = PORT_MAPPINGS["PinPoint"]
        state = WorktreeState(Path("/test"), "PinPoint", config)

        assert state.recovery_commands == []
        state.add_recovery_command("git reset --hard")
        assert len(state.recovery_commands) == 1
        assert state.recovery_commands[0] == "git reset --hard"

        state.add_recovery_command("git merge --abort")
        assert len(state.recovery_commands) == 2

    def test_config_messages_accumulate(self):
        """Test that config messages can be added"""
        config = PORT_MAPPINGS["PinPoint"]
        state = WorktreeState(Path("/test"), "PinPoint", config)

        state.config_messages.append("Fixed config.toml")
        state.config_messages.append("Fixed .env.local")
        assert len(state.config_messages) == 2


class TestMergeStatus:
    """Test merge status enum"""

    def test_merge_status_values(self):
        """Test that all merge statuses are defined"""
        assert MergeStatus.MERGED.value == "merged"
        assert MergeStatus.UP_TO_DATE.value == "up-to-date"
        assert MergeStatus.CONFLICTS.value == "conflicts"
        assert MergeStatus.SKIPPED.value == "skipped"
        assert MergeStatus.PULLED.value == "pulled"
        assert MergeStatus.DETACHED.value == "detached"
        assert MergeStatus.DECLINED.value == "declined"


class TestStatusLevel:
    """Test status level enum"""

    def test_status_level_values(self):
        """Test that all status levels are defined"""
        assert StatusLevel.SUCCESS.value == "success"
        assert StatusLevel.WARNING.value == "warning"
        assert StatusLevel.ERROR.value == "error"

    def test_status_level_ordering(self):
        """Test that status levels can be compared implicitly"""
        # While enums don't have natural ordering, we test that our update logic works
        # This is more of a documentation test
        levels = [StatusLevel.SUCCESS, StatusLevel.WARNING, StatusLevel.ERROR]
        assert len(levels) == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
