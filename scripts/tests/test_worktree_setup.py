"""Unit tests for worktree_setup.py env merging and port allocation."""

import json
import re
import shutil
import sys
from pathlib import Path

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from worktree_setup import (
    DEFAULT_INSTALL_TIMEOUT,
    EXIT_INCOMPLETE,
    EXIT_READY,
    FAILURE_CLASS_INSTALL,
    FAILURE_CLASS_MISSING_TOOL,
    FAILURE_CLASS_NETWORK,
    FAILURE_CLASS_TIMEOUT,
    FAILURE_CLASS_TOOLCHAIN_CONFIG,
    LOCAL_SUPABASE_PUBLISHABLE_KEY,
    LOCAL_SUPABASE_SERVICE_ROLE_KEY,
    MANAGED_ENV_KEYS,
    MAX_INSTALL_TIMEOUT,
    BootstrapToolchain,
    PortConfig,
    RuntimeDiagnostics,
    RuntimeInfo,
    allocate_slot,
    branch_to_project_id,
    classify_install_failure,
    collect_runtime_diagnostics,
    generate_config_toml,
    generate_launch_json,
    install_dependencies,
    load_manifest,
    main,
    merge_env_local,
    parse_env_file,
    prune_manifest,
    read_bootstrap_tool_versions,
    read_pinned_project_id,
    resolve_brainstorm_server_path,
    resolve_install_timeout,
    resolve_preinstalled_toolchain,
    resolve_project_id,
)

# Testing philosophy for worktree setup
# ────────────────────────────────────────────────────────────────────────────
# Worktree setup is infrastructure code: it runs once per worktree, fails
# benignly (config not generated → fixable manually), and any error surfaces
# immediately on the next branch switch. We primarily test by running it.
#
# Keep unit tests minimal. Focus on logic that's hard to verify by usage —
# parsing env files, port allocation, ID derivation, JSON manifest correctness.
# Don't add unit tests for git/subprocess interactions; those tests test mocks
# more than real behavior, and the integration path (run the post-checkout
# hook in a real worktree) is faster and more accurate.


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
            "UNSUBSCRIBE_SIGNING_SECRET",
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
        assert names == ["next-dev", "brainstorm", "scotty"]

        next_dev = next(c for c in configs if c["name"] == "next-dev")
        assert next_dev["runtimeExecutable"] == "mise"
        assert next_dev["runtimeArgs"] == [
            "exec",
            "--",
            "pnpm",
            "run",
            "dev",
        ]
        assert next_dev["port"] == port_config.nextjs_port

        # Attach-only and on a fixed port: the beads viewer is one host-global
        # server every worktree points at, so it is deliberately not slotted.
        scotty = next(c for c in configs if c["name"] == "scotty")
        assert scotty["port"] == 8765
        assert "runtimeExecutable" not in scotty

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
        # Scotty is unconditional — it attaches to a host-global server rather
        # than starting one, so there is nothing for it to depend on.
        assert names == ["next-dev", "scotty"]
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
        assert len(result) <= 40

    def test_trailing_special_chars_stripped(self) -> None:
        result = branch_to_project_id("my-feature///")
        assert not result.endswith("-")

    def test_long_branch_uses_hash_suffix(self) -> None:
        # The branch from PP-xwm casework that triggered Docker overflow.
        long_branch = "feat/e2e-cleanup-admin-discord-downgrade-PP-t8o"
        result = branch_to_project_id(long_branch)
        assert len(result) == 40
        assert result.startswith("pinpoint-feat-e2e-cleanup-admin")
        # 8-char hex hash suffix joined by a single "-"
        assert re.match(r"^pinpoint-.{22}-[0-9a-f]{8}$", result), result

    def test_long_branch_hash_is_deterministic(self) -> None:
        long_branch = "feat/some-very-long-branch-name-that-exceeds-the-cap"
        assert branch_to_project_id(long_branch) == branch_to_project_id(long_branch)

    def test_long_branches_with_common_prefix_get_distinct_ids(self) -> None:
        # Same first N chars but different tail → hash must disambiguate.
        a = branch_to_project_id("feat/very-long-shared-prefix-branch-alpha")
        b = branch_to_project_id("feat/very-long-shared-prefix-branch-beta")
        assert a != b

    def test_long_branch_no_trailing_hyphen_after_truncation(self) -> None:
        # Construct a branch where the 31-char readable portion would end
        # exactly on a hyphen — rstrip must clean it before joining the hash.
        long_branch = "feat-aaaaaaaaaaaaaaaaaaaaa-bbb-cc"
        result = branch_to_project_id(long_branch)
        assert "--" not in result
        assert len(result) <= 40

    def test_boundary_40_char_branch_no_hash(self) -> None:
        # Exactly 31 char sanitized → "pinpoint-" + 31 = 40 chars, no hash.
        branch = "a" * 31
        result = branch_to_project_id(branch)
        assert result == f"pinpoint-{'a' * 31}"
        assert len(result) == 40

    def test_boundary_41_char_branch_uses_hash(self) -> None:
        # 32 char sanitized → "pinpoint-" + 32 = 41 chars, hash applied.
        branch = "a" * 32
        result = branch_to_project_id(branch)
        assert len(result) == 40
        assert re.match(r"^pinpoint-a{22}-[0-9a-f]{8}$", result), result


class TestPinnedProjectId:
    """Test project_id pinning — the id must survive a branch rename (PP-4936)."""

    def _write_config(self, worktree: Path, body: str) -> Path:
        config = worktree / "supabase" / "config.toml"
        config.parent.mkdir(parents=True, exist_ok=True)
        config.write_text(body)
        return config

    def test_reads_generated_project_id(self, tmp_path: Path) -> None:
        self._write_config(
            tmp_path,
            "# ⚠️ AUTO-GENERATED — DO NOT EDIT ⚠️\n"
            'project_id = "pinpoint-worktree-old-branch"\n'
            "[api]\nport = 54421\n",
        )

        assert read_pinned_project_id(tmp_path) == "pinpoint-worktree-old-branch"

    def test_missing_config_is_not_pinned(self, tmp_path: Path) -> None:
        # Fresh worktree: config.toml is gitignored, so it doesn't exist yet.
        assert read_pinned_project_id(tmp_path) is None

    def test_config_without_project_id_is_not_pinned(self, tmp_path: Path) -> None:
        self._write_config(tmp_path, "[api]\nport = 54421\n")

        assert read_pinned_project_id(tmp_path) is None

    def test_commented_project_id_is_ignored(self, tmp_path: Path) -> None:
        self._write_config(
            tmp_path,
            '# project_id = "pinpoint-commented-out"\nproject_id = "pinpoint-real"\n',
        )

        assert read_pinned_project_id(tmp_path) == "pinpoint-real"

    def test_bare_template_id_is_not_pinnable(self, tmp_path: Path) -> None:
        # config.toml.template ships `project_id = "pinpoint"`. Pinning that
        # would give every worktree the same container names.
        self._write_config(tmp_path, 'project_id = "pinpoint"\n')

        assert read_pinned_project_id(tmp_path) is None

    @pytest.mark.parametrize(
        "value",
        [
            "not-pinpoint-prefixed",  # invisible to worktree_orphan_sweep.py
            "pinpoint-Has-Uppercase",  # not a legal Docker/Supabase id
            "pinpoint-has_underscore",
            "pinpoint-" + "a" * 40,  # over MAX_PROJECT_ID_LEN
        ],
    )
    def test_malformed_ids_fall_back_to_derivation(
        self, tmp_path: Path, value: str
    ) -> None:
        self._write_config(tmp_path, f'project_id = "{value}"\n')

        assert read_pinned_project_id(tmp_path) is None
        assert resolve_project_id(tmp_path, "feat/new") == "pinpoint-feat-new"

    def test_hashed_max_length_id_is_pinnable(self, tmp_path: Path) -> None:
        # Long branches (every `worktree-agent-*`/`feat/…-PP-…` name) hash to
        # exactly MAX_PROJECT_ID_LEN. An off-by-one in the length gate would
        # silently refuse to pin the most common case.
        long_branch = "feat/pin-worktree-supabase-project-id-PP-4936"
        derived = branch_to_project_id(long_branch)
        assert len(derived) == 40

        self._write_config(tmp_path, f'project_id = "{derived}"\n')

        assert read_pinned_project_id(tmp_path) == derived
        assert resolve_project_id(tmp_path, "some/other-branch") == derived

    def test_trailing_newline_in_id_is_rejected(self, tmp_path: Path) -> None:
        # A `$`-anchored check would accept this and write a corrupt id back.
        self._write_config(tmp_path, 'project_id = "pinpoint-broken\n"\n')

        assert read_pinned_project_id(tmp_path) is None

    def test_unreadable_config_does_not_raise(self, tmp_path: Path) -> None:
        # This runs from the post-checkout hook — an exception here would skip
        # the rest of the worktree's config generation. A directory where
        # config.toml should be (OSError) and undecodable bytes
        # (UnicodeDecodeError) both have to come back as "not pinned".
        (tmp_path / "supabase" / "config.toml").mkdir(parents=True)
        assert read_pinned_project_id(tmp_path) is None

        binary = tmp_path / "binary"
        (binary / "supabase").mkdir(parents=True)
        (binary / "supabase" / "config.toml").write_bytes(b"\xff\xfe\x00project_id")
        assert read_pinned_project_id(binary) is None

    def test_resolve_derives_from_branch_when_unpinned(self, tmp_path: Path) -> None:
        assert resolve_project_id(tmp_path, "feat/thing") == "pinpoint-feat-thing"

    def test_resolve_keeps_pinned_id_after_branch_rename(self, tmp_path: Path) -> None:
        # The PP-4936 reproduction: worktree set up on one branch, then
        # `git checkout -b` inside it. The stack is already running under the
        # original id, so the id must not follow the branch.
        self._write_config(tmp_path, 'project_id = "pinpoint-worktree-pbm-token"\n')

        assert (
            resolve_project_id(tmp_path, "feat/pbm-token-env-var")
            == "pinpoint-worktree-pbm-token"
        )

    def test_generated_config_round_trips_its_own_id(self, tmp_path: Path) -> None:
        # End-to-end: generate a config for branch A, then resolve for branch B
        # and confirm A's id survives — i.e. regeneration is idempotent on the
        # project_id even as the branch changes.
        template = tmp_path / "supabase" / "config.toml.template"
        template.parent.mkdir(parents=True)
        template.write_text('project_id = "pinpoint"\n[api]\nport = 54321\n')

        first = PortConfig(
            slot=3,
            project_id=resolve_project_id(tmp_path, "worktree-agent-abc"),
            name="worktree-agent-abc",
        )
        (tmp_path / "supabase" / "config.toml").write_text(
            generate_config_toml(tmp_path, first)
        )

        assert first.project_id == "pinpoint-worktree-agent-abc"
        assert resolve_project_id(tmp_path, "feat/renamed") == first.project_id


class TestRuntimeDiagnostics:
    """Test runtime path and version diagnostics collection."""

    def test_collect_returns_all_runtimes(self) -> None:
        diag = collect_runtime_diagnostics()
        assert isinstance(diag.python, RuntimeInfo)
        assert diag.python.path is not None
        assert diag.python.version is not None
        assert isinstance(diag.node, RuntimeInfo)
        assert isinstance(diag.pnpm, RuntimeInfo)
        assert isinstance(diag.git, RuntimeInfo)

    def test_path_tool_probes_can_be_disabled(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        original_which = shutil.which

        def guarded_which(tool: str) -> str | None:
            if tool in {"node", "pnpm"}:
                pytest.fail(f"must not probe {tool} through PATH")
            return original_which(tool)

        monkeypatch.setattr("worktree_setup.shutil.which", guarded_which)

        diag = collect_runtime_diagnostics(probe_path_tools=False)

        assert diag.node == RuntimeInfo(path=None, version=None)
        assert diag.pnpm == RuntimeInfo(path=None, version=None)

    def test_format_summary_with_all_runtimes(self) -> None:
        diag = RuntimeDiagnostics(
            python=RuntimeInfo(path="/usr/bin/python3", version="3.14.0"),
            node=RuntimeInfo(path="/usr/local/bin/node", version="v24.0.0"),
            pnpm=RuntimeInfo(path="/usr/local/bin/pnpm", version="10.0.0"),
            git=RuntimeInfo(path="/usr/bin/git", version="2.48.0"),
        )
        summary = diag.format_summary()
        assert "python=/usr/bin/python3 (3.14.0)" in summary
        assert "node=/usr/local/bin/node (v24.0.0)" in summary
        assert "pnpm=/usr/local/bin/pnpm (10.0.0)" in summary
        assert "git=/usr/bin/git (2.48.0)" in summary

    def test_format_summary_with_missing_tool(self) -> None:
        diag = RuntimeDiagnostics(
            python=RuntimeInfo(path="/usr/bin/python3", version="3.14.0"),
            node=RuntimeInfo(path=None, version=None),
            pnpm=RuntimeInfo(path=None, version=None),
            git=RuntimeInfo(path="/usr/bin/git", version="2.48.0"),
        )
        summary = diag.format_summary()
        assert "node=<not found>" in summary
        assert "pnpm=<not found>" in summary


class TestClassifyInstallFailure:
    """Test failure classification of install outcomes."""

    @pytest.mark.parametrize(
        "error_snippet",
        [
            "getaddrinfo ENOTFOUND registry.npmjs.org",
            "ETIMEDOUT connecting to registry",
            "ECONNREFUSED 127.0.0.1:4873",
            "ECONNRESET by peer",
            "EAI_AGAIN failed to resolve host",
            "ERR_PNPM_FETCH_404 registry error",
            "TypeError: fetch failed",
            "network error while downloading tarball",
            "request to https://registry.npmjs.org failed",
            "CERT_HAS_EXPIRED",
        ],
    )
    def test_classifies_network_failures(self, error_snippet: str) -> None:
        result = classify_install_failure(1, "", error_snippet)
        assert result == FAILURE_CLASS_NETWORK

    def test_classifies_general_install_failure(self) -> None:
        result = classify_install_failure(
            1, "", "ERR_PNPM_OUTDATED_LOCKFILE Cannot install with --frozen-lockfile"
        )
        assert result == FAILURE_CLASS_INSTALL


class TestBootstrapToolVersions:
    """Test the narrow branch-controlled inputs accepted by bootstrap."""

    def _write_contract(self, root: Path, package_manager: str) -> None:
        (root / "mise.toml").write_text('[tools]\nnode = "24.19.0"\n')
        (root / "package.json").write_text(
            json.dumps({"packageManager": package_manager}) + "\n"
        )

    def test_reads_exact_node_and_integrity_qualified_pnpm(
        self, tmp_path: Path
    ) -> None:
        self._write_contract(
            tmp_path,
            "pnpm@11.17.0+sha512." + "a" * 128,
        )

        assert read_bootstrap_tool_versions(tmp_path) == ("24.19.0", "11.17.0")

    @pytest.mark.parametrize(
        "package_manager",
        [
            "pnpm@11.17.0",
            "pnpm@11.17+sha512." + "a" * 128,
            "pnpm@11.17.0+sha512." + "a" * 127,
            "npm@11.17.0+sha512." + "a" * 128,
        ],
    )
    def test_rejects_non_exact_or_unqualified_pnpm(
        self, tmp_path: Path, package_manager: str
    ) -> None:
        self._write_contract(tmp_path, package_manager)

        with pytest.raises(ValueError, match="exact pnpm"):
            read_bootstrap_tool_versions(tmp_path)

    def test_resolution_reports_invalid_contract_without_running_mise(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        self._write_contract(tmp_path, "pnpm@11.17.0")
        monkeypatch.setattr(
            "worktree_setup.shutil.which",
            lambda tool: pytest.fail(
                f"must not resolve {tool} for an invalid contract"
            ),
        )

        toolchain, failure_class, detail = resolve_preinstalled_toolchain(tmp_path)

        assert toolchain is None
        assert failure_class == FAILURE_CLASS_TOOLCHAIN_CONFIG
        assert "exact pnpm" in (detail or "")


class TestInstallDependencies:
    """Test dependency installation logic."""

    @pytest.fixture
    def toolchain(self, tmp_path: Path) -> BootstrapToolchain:
        return BootstrapToolchain(
            node_path=tmp_path / "mise" / "node" / "bin" / "node",
            node_version="24.19.0",
            pnpm_path=tmp_path / "mise" / "pnpm" / "bin" / "pnpm",
            pnpm_version="11.17.0",
        )

    def test_existing_node_modules_is_ready_immediately(self, tmp_path: Path) -> None:
        nm = tmp_path / "node_modules"
        nm.mkdir()
        (nm / ".modules.yaml").touch()
        is_ready, failure_class, detail = install_dependencies(tmp_path)
        assert is_ready is True
        assert failure_class is None
        assert detail is None

    def test_partial_node_modules_runs_install(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        toolchain: BootstrapToolchain,
    ) -> None:
        import subprocess

        # node_modules exists without .modules.yaml (interrupted install)
        (tmp_path / "node_modules").mkdir()
        mock_res = subprocess.CompletedProcess(
            args=["pnpm", "install"], returncode=0, stdout="Done", stderr=""
        )
        monkeypatch.setattr(
            "worktree_setup.subprocess.run", lambda *args, **kwargs: mock_res
        )

        is_ready, failure_class, detail = install_dependencies(
            tmp_path, toolchain=toolchain
        )
        assert is_ready is True
        assert failure_class is None

    def test_missing_pnpm_returns_missing_tool_failure(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        (tmp_path / "mise.toml").write_text('[tools]\nnode = "24.19.0"\n')
        (tmp_path / "package.json").write_text(
            '{"packageManager":"pnpm@11.17.0+sha512.' + "a" * 128 + '"}\n'
        )
        monkeypatch.setattr(
            "worktree_setup.shutil.which",
            lambda tool: None if tool == "mise" else f"/bin/{tool}",
        )
        is_ready, failure_class, detail = install_dependencies(tmp_path)
        assert is_ready is False
        assert failure_class == FAILURE_CLASS_MISSING_TOOL
        assert "mise executable not found in PATH" in (detail or "")

    def test_successful_pnpm_install_returns_ready(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        toolchain: BootstrapToolchain,
    ) -> None:
        import subprocess

        mock_res = subprocess.CompletedProcess(
            args=["pnpm", "install"], returncode=0, stdout="Done", stderr=""
        )
        monkeypatch.setattr(
            "worktree_setup.subprocess.run", lambda *args, **kwargs: mock_res
        )

        is_ready, failure_class, detail = install_dependencies(
            tmp_path, toolchain=toolchain
        )
        assert is_ready is True
        assert failure_class is None
        assert detail is None

    def test_nonzero_install_returns_install_failure(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        toolchain: BootstrapToolchain,
    ) -> None:
        import subprocess

        mock_res = subprocess.CompletedProcess(
            args=["pnpm", "install"],
            returncode=1,
            stdout="",
            stderr="ERR_PNPM_LOCKFILE_MISSING: lockfile is missing\n",
        )
        monkeypatch.setattr(
            "worktree_setup.subprocess.run", lambda *args, **kwargs: mock_res
        )

        is_ready, failure_class, detail = install_dependencies(
            tmp_path, toolchain=toolchain
        )
        assert is_ready is False
        assert failure_class == FAILURE_CLASS_INSTALL
        assert "pnpm install failed (exit 1)" in (detail or "")

    def test_network_failure_classified(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        toolchain: BootstrapToolchain,
    ) -> None:
        import subprocess

        mock_res = subprocess.CompletedProcess(
            args=["pnpm", "install"],
            returncode=1,
            stdout="",
            stderr="getaddrinfo ENOTFOUND registry.npmjs.org\n",
        )
        monkeypatch.setattr(
            "worktree_setup.subprocess.run", lambda *args, **kwargs: mock_res
        )

        is_ready, failure_class, detail = install_dependencies(
            tmp_path, toolchain=toolchain
        )
        assert is_ready is False
        assert failure_class == FAILURE_CLASS_NETWORK

    def test_timeout_returns_timeout_failure(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        toolchain: BootstrapToolchain,
    ) -> None:
        import subprocess

        def _mock_run(*args, **kwargs):
            raise subprocess.TimeoutExpired(cmd=["pnpm", "install"], timeout=10)

        monkeypatch.setattr("worktree_setup.subprocess.run", _mock_run)

        is_ready, failure_class, detail = install_dependencies(
            tmp_path, timeout=10, toolchain=toolchain
        )
        assert is_ready is False
        assert failure_class == FAILURE_CLASS_TIMEOUT
        assert "timed out after 10s" in (detail or "")

    def test_resolve_install_timeout_uses_env_and_caps(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PINPOINT_WORKTREE_INSTALL_TIMEOUT", "45")
        assert resolve_install_timeout() == 45

        # Capped at MAX_INSTALL_TIMEOUT
        monkeypatch.setenv("PINPOINT_WORKTREE_INSTALL_TIMEOUT", "300")
        assert resolve_install_timeout() == MAX_INSTALL_TIMEOUT

        monkeypatch.delenv("PINPOINT_WORKTREE_INSTALL_TIMEOUT", raising=False)
        monkeypatch.setenv("WORKTREE_INSTALL_TIMEOUT", "75")
        assert resolve_install_timeout() == 75

        monkeypatch.delenv("WORKTREE_INSTALL_TIMEOUT", raising=False)
        assert resolve_install_timeout() == DEFAULT_INSTALL_TIMEOUT


class TestWorktreeSetupMainReadiness:
    """Test full worktree setup execution and exit codes."""

    @pytest.fixture(autouse=True)
    def _setup_env(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        self.manifest_path = tmp_path / "worktree-slots.json"
        monkeypatch.setattr("worktree_setup.MANIFEST_PATH", self.manifest_path)
        self.main_wt = tmp_path / "main_wt"
        self.main_wt.mkdir()
        self.linked_wt = tmp_path / "linked_wt"
        self.linked_wt.mkdir()
        # Create template in linked_wt
        supa = self.linked_wt / "supabase"
        supa.mkdir()
        (supa / "config.toml.template").write_text(
            'project_id = "pinpoint"\n[api]\nport = 54321\n'
        )

        monkeypatch.setattr("worktree_setup.get_main_worktree", lambda: self.main_wt)
        monkeypatch.setattr("worktree_setup.get_branch", lambda: "feat/my-branch")
        monkeypatch.setattr(
            "worktree_setup.configure_branch_tracking", lambda branch, path: None
        )
        monkeypatch.setattr("worktree_setup.Path.cwd", lambda: self.linked_wt)

    def test_main_worktree_noop_returns_ready(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr("worktree_setup.Path.cwd", lambda: self.main_wt)
        assert main() == EXIT_READY

    def test_linked_worktree_ready_when_deps_exist(
        self, capsys: pytest.CaptureFixture
    ) -> None:
        nm = self.linked_wt / "node_modules"
        nm.mkdir()
        (nm / ".modules.yaml").touch()
        code = main()
        assert code == EXIT_READY
        captured = capsys.readouterr()
        assert "status=ready" in captured.err
        assert "runtimes:" in captured.err
        assert (self.linked_wt / ".env.local").exists()
        assert (self.linked_wt / "supabase/config.toml").exists()
        assert (self.linked_wt / ".claude/launch.json").exists()

    def test_linked_worktree_incomplete_on_install_failure(
        self, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture
    ) -> None:
        toolchain = BootstrapToolchain(
            node_path=Path("/mise/node/bin/node"),
            node_version="24.19.0",
            pnpm_path=Path("/mise/pnpm/bin/pnpm"),
            pnpm_version="11.17.0",
        )
        monkeypatch.setattr(
            "worktree_setup.resolve_preinstalled_toolchain",
            lambda path: (toolchain, None, None),
        )
        monkeypatch.setattr(
            "worktree_setup.install_dependencies",
            lambda path, timeout=None, toolchain=None: (
                False,
                FAILURE_CLASS_MISSING_TOOL,
                "pnpm not found",
            ),
        )
        code = main()
        assert code == EXIT_INCOMPLETE
        captured = capsys.readouterr()
        assert "status=incomplete" in captured.err
        assert "failure_class=missing-tool" in captured.err
        # Generated files must still be written with 444 permissions
        assert (self.linked_wt / ".env.local").exists()
        assert (self.linked_wt / "supabase" / "config.toml").exists()

    def test_failed_toolchain_resolution_never_probes_path_node_or_pnpm(
        self, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture
    ) -> None:
        monkeypatch.setattr(
            "worktree_setup.resolve_preinstalled_toolchain",
            lambda path: (
                None,
                FAILURE_CLASS_MISSING_TOOL,
                "preinstalled pnpm is missing",
            ),
        )
        original_which = shutil.which

        def guarded_which(tool: str) -> str | None:
            if tool in {"node", "pnpm"}:
                pytest.fail(f"must not probe {tool} through PATH")
            return original_which(tool)

        monkeypatch.setattr("worktree_setup.shutil.which", guarded_which)

        code = main()

        assert code == EXIT_INCOMPLETE
        captured = capsys.readouterr()
        assert "node=<not found>" in captured.err
        assert "pnpm=<not found>" in captured.err
        assert "failure_class=missing-tool" in captured.err


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
