"""Policy tests for PinPoint's mise-only hosted Renovate configuration."""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RENOVATE_CONFIG_PATH = REPO_ROOT / ".github" / "renovate.json"
DEPENDABOT_CONFIG_PATH = REPO_ROOT / ".github" / "dependabot.yml"


def _config() -> dict[str, object]:
    return json.loads(RENOVATE_CONFIG_PATH.read_text(encoding="utf-8"))


def test_renovate_is_mise_only_and_never_automerge() -> None:
    config = _config()

    assert config["enabledManagers"] == ["mise"]
    assert config["includePaths"] == ["mise.toml"]
    assert config["automerge"] is False
    assert config["ignoreScripts"] is True
    assert config["lockFileMaintenance"] == {"enabled": False}


def test_renovate_cooldowns_fail_closed() -> None:
    config = _config()

    assert config["minimumReleaseAge"] == "14 days"
    assert config["minimumReleaseAgeBehaviour"] == "timestamp-required"
    assert config["internalChecksFilter"] == "strict"
    assert config["prCreation"] == "immediate"

    package_rules = config["packageRules"]
    assert isinstance(package_rules, list)
    assert all(rule.get("matchManagers") == ["mise"] for rule in package_rules)
    # The only group is the minor/patch toolchain PR. It must not carry its own
    # cooldown, take majors, or take the Supabase CLI, so every soak rule below
    # keeps applying per tool.
    grouped = [rule for rule in package_rules if "groupName" in rule]
    assert len(grouped) == 1
    assert all("groupSlug" not in rule for rule in package_rules)
    group_rule = grouped[0]
    assert group_rule["groupName"] == "toolchain"
    assert group_rule["matchUpdateTypes"] == ["minor", "patch"]
    assert "!supabase/cli" in group_rule["matchPackageNames"]
    assert "minimumReleaseAge" not in group_rule

    supabase_rule = next(
        rule
        for rule in package_rules
        if rule.get("matchPackageNames") == ["supabase/cli"]
    )
    assert supabase_rule["minimumReleaseAge"] == "7 days"

    major_rule = next(
        rule for rule in package_rules if rule.get("matchUpdateTypes") == ["major"]
    )
    assert major_rule["minimumReleaseAge"] == "30 days"


def test_dependabot_keeps_exclusive_npm_and_actions_ownership() -> None:
    dependabot = DEPENDABOT_CONFIG_PATH.read_text(encoding="utf-8")

    assert dependabot.count('package-ecosystem: "npm"') == 1
    assert dependabot.count('package-ecosystem: "github-actions"') == 1
    assert 'package-ecosystem: "docker"' not in dependabot
    assert 'package-ecosystem: "mise"' not in dependabot
