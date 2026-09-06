"""Tests for scripts/check_skill_frontmatter.py — the SKILL.md YAML frontmatter gate."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from check_skill_frontmatter import (  # noqa: E402
    check_skill_file,
    extract_frontmatter,
    find_skill_files,
    parse_top_level_keys,
)

CONFIG_PATH = Path(".yamllint.yml")


def test_extract_frontmatter():
    valid = "---\nname: foo\ndescription: bar\n---\n\n# Body"
    assert extract_frontmatter(valid) == "name: foo\ndescription: bar"

    no_fm = "# Just markdown\nNo frontmatter here."
    assert extract_frontmatter(no_fm) is None

    unclosed = "---\nname: foo\ndescription: bar\n"
    assert extract_frontmatter(unclosed) is None


def test_parse_top_level_keys():
    fm = "name: my-skill\ndescription: >-\n  Some long\n  description\nversion: 1"
    keys = parse_top_level_keys(fm)
    assert keys["name"] == "my-skill"
    assert keys["version"] == "1"
    assert "description" in keys


def test_valid_skill_file(tmp_path: Path):
    skill_dir = tmp_path / "sample-skill"
    skill_dir.mkdir()
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text(
        "---\n"
        "name: sample-skill\n"
        "description: >-\n"
        "  A valid description.\n"
        "---\n\n"
        "# Sample Skill\n",
        encoding="utf-8",
    )

    errors = check_skill_file(skill_file, config_path=CONFIG_PATH)
    assert errors == []


def test_yaml_syntax_error(tmp_path: Path):
    skill_dir = tmp_path / "broken-skill"
    skill_dir.mkdir()
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text(
        "---\n"
        "name: broken-skill\n"
        "description: unquoted text with: invalid mapping syntax\n"
        "---\n\n"
        "# Broken Skill\n",
        encoding="utf-8",
    )

    errors = check_skill_file(skill_file, config_path=CONFIG_PATH)
    assert len(errors) == 1
    assert "YAML frontmatter syntax error" in errors[0]


def test_missing_frontmatter(tmp_path: Path):
    skill_dir = tmp_path / "no-fm"
    skill_dir.mkdir()
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text("# No frontmatter\nJust text.\n", encoding="utf-8")

    errors = check_skill_file(skill_file, config_path=CONFIG_PATH)
    assert len(errors) == 1
    assert "Missing or malformed YAML frontmatter" in errors[0]


def test_missing_name(tmp_path: Path):
    skill_dir = tmp_path / "unnamed"
    skill_dir.mkdir()
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text(
        "---\ndescription: Some description\n---\n\n# Body\n",
        encoding="utf-8",
    )

    errors = check_skill_file(skill_file, config_path=CONFIG_PATH)
    assert any("Missing or empty 'name'" in err for err in errors)


def test_name_mismatch(tmp_path: Path):
    skill_dir = tmp_path / "actual-dir-name"
    skill_dir.mkdir()
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text(
        "---\nname: different-name\ndescription: Some description\n---\n\n# Body\n",
        encoding="utf-8",
    )

    errors = check_skill_file(skill_file, config_path=CONFIG_PATH)
    assert any("does not match folder" in err for err in errors)


def test_missing_description(tmp_path: Path):
    skill_dir = tmp_path / "no-desc"
    skill_dir.mkdir()
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text(
        "---\nname: no-desc\n---\n\n# Body\n",
        encoding="utf-8",
    )

    errors = check_skill_file(skill_file, config_path=CONFIG_PATH)
    assert any("Missing 'description'" in err for err in errors)


def test_find_skill_files(tmp_path: Path):
    (tmp_path / "skill-a").mkdir()
    (tmp_path / "skill-a" / "SKILL.md").write_text("a", encoding="utf-8")
    (tmp_path / "skill-b").mkdir()
    (tmp_path / "skill-b" / "SKILL.md").write_text("b", encoding="utf-8")

    files = find_skill_files([tmp_path])
    assert len(files) == 2
    assert files[0].name == "SKILL.md"


def test_real_repo_skills_pass():
    skills = find_skill_files([Path(".agents/skills")])
    assert len(skills) >= 16
    for skill_file in skills:
        errors = check_skill_file(skill_file, config_path=CONFIG_PATH)
        assert errors == [], f"Errors in {skill_file}: {errors}"
