"""Tests for scripts/check_rule_ids.py — the CORE-* citation gate.

The gate exists because PinPoint states its rules in several hand-written
places (catalog, CLAUDE.md, .claude/rules/, .github/instructions/) that are
deliberately NOT generated from one source. It catches the drift that bites:
a rule renamed or deleted while citations linger.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from check_rule_ids import (  # noqa: E402
    collect_catalog_ids,
    collect_citations,
    extract_ids,
    find_repo_root,
    main,
)

CATALOG_REL = "docs/NON_NEGOTIABLES.md"


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A minimal fake repo with a catalog and one citing file."""
    (tmp_path / "docs").mkdir()
    (tmp_path / CATALOG_REL).write_text(
        "# Catalog\n\n- CORE-ARCH-009 migrations only\n- CORE-SEC-008 localhost\n"
        "- CORE-TS-007 no any\n",
        encoding="utf-8",
    )
    return tmp_path


class TestExtractIds:
    def test_finds_well_formed_ids(self):
        assert extract_ids("see CORE-ARCH-009 and CORE-A11Y-006.") == {
            "CORE-ARCH-009",
            "CORE-A11Y-006",
        }

    def test_ignores_malformed_ids(self):
        # Too few digits, lowercase category, and a missing segment.
        text = "CORE-ARCH-9 core-arch-009 CORE--009 CORE-ARCH"
        assert extract_ids(text) == set()

    def test_handles_numeric_category(self):
        assert "CORE-A11Y-001" in extract_ids("CORE-A11Y-001")

    def test_returns_empty_for_no_matches(self):
        assert extract_ids("nothing to see") == set()

    def test_expands_dotdot_range_shorthand(self):
        # AGENTS.md §2.1 cites contiguous blocks as e.g. CORE-RESP-001..004
        # instead of spelling out every ID. Without expansion, only the
        # range's start ID is ever extracted -- the end ID and every
        # interior ID are silently never checked against the catalog.
        assert extract_ids("CORE-RESP-001..004") == {
            "CORE-RESP-001",
            "CORE-RESP-002",
            "CORE-RESP-003",
            "CORE-RESP-004",
        }

    def test_expands_range_alongside_plain_ids(self):
        text = "CORE-ARCH-009 and CORE-FORM-001..006"
        assert extract_ids(text) == {
            "CORE-ARCH-009",
            "CORE-FORM-001",
            "CORE-FORM-002",
            "CORE-FORM-003",
            "CORE-FORM-004",
            "CORE-FORM-005",
            "CORE-FORM-006",
        }


class TestCatalogAndCitations:
    def test_reads_catalog_ids(self, repo: Path):
        assert collect_catalog_ids(repo) == {
            "CORE-ARCH-009",
            "CORE-SEC-008",
            "CORE-TS-007",
        }

    def test_collects_from_claude_md(self, repo: Path):
        (repo / "CLAUDE.md").write_text("Follow CORE-ARCH-009.", encoding="utf-8")
        assert collect_citations(repo) == {"CLAUDE.md": {"CORE-ARCH-009"}}

    def test_collects_from_globbed_rule_files(self, repo: Path):
        rules = repo / ".claude" / "rules"
        rules.mkdir(parents=True)
        (rules / "database.md").write_text("CORE-ARCH-009", encoding="utf-8")
        assert collect_citations(repo) == {
            ".claude/rules/database.md": {"CORE-ARCH-009"}
        }

    def test_overlapping_globs_do_not_double_count(self, repo: Path):
        # rules/*.md and rules/**/*.md both match a top-level rule file.
        rules = repo / ".claude" / "rules"
        rules.mkdir(parents=True)
        (rules / "a.md").write_text("CORE-SEC-008", encoding="utf-8")
        citations = collect_citations(repo)
        assert list(citations) == [".claude/rules/a.md"]

    def test_missing_optional_sources_are_fine(self, repo: Path):
        # CODE_REVIEW.md and .claude/rules/ do not exist until PP-22e4 lands.
        assert collect_citations(repo) == {}

    def test_files_without_ids_are_omitted(self, repo: Path):
        (repo / "CLAUDE.md").write_text("no rules here", encoding="utf-8")
        assert collect_citations(repo) == {}


class TestMain:
    def test_passes_when_all_citations_resolve(self, repo: Path, capsys):
        (repo / "CLAUDE.md").write_text(
            "CORE-ARCH-009 and CORE-SEC-008", encoding="utf-8"
        )
        assert main(["--root", str(repo)]) == 0

    def test_fails_on_unknown_id(self, repo: Path, capsys):
        (repo / "CLAUDE.md").write_text("CORE-ARCH-999 is fake", encoding="utf-8")
        assert main(["--root", str(repo)]) == 1
        err = capsys.readouterr().err
        assert "CORE-ARCH-999" in err
        assert "CLAUDE.md" in err

    def test_reports_every_unknown_id(self, repo: Path, capsys):
        (repo / "CLAUDE.md").write_text("CORE-ARCH-999", encoding="utf-8")
        (repo / "AGENTS.md").write_text("CORE-FAKE-001", encoding="utf-8")
        assert main(["--root", str(repo)]) == 1
        err = capsys.readouterr().err
        assert "CORE-ARCH-999" in err
        assert "CORE-FAKE-001" in err

    def test_missing_catalog_exits_2(self, tmp_path: Path, capsys):
        assert main(["--root", str(tmp_path)]) == 2
        assert "catalog not found" in capsys.readouterr().err

    def test_orphans_are_silent_by_default(self, repo: Path, capsys):
        # 42 of ~62 real catalog rules are orphans; printing them every run
        # would train everyone to ignore the gate.
        (repo / "CLAUDE.md").write_text("CORE-ARCH-009", encoding="utf-8")
        assert main(["--root", str(repo)]) == 0
        assert "cited by no hook" not in capsys.readouterr().err

    def test_orphans_reported_on_request(self, repo: Path, capsys):
        (repo / "CLAUDE.md").write_text("CORE-ARCH-009", encoding="utf-8")
        assert main(["--root", str(repo), "--orphans"]) == 0
        err = capsys.readouterr().err
        assert "CORE-SEC-008" in err
        assert "CORE-TS-007" in err
        assert "CORE-ARCH-009" not in err  # cited, so not an orphan

    def test_range_citation_catches_missing_interior_id(self, repo: Path, capsys):
        # CORE-RESP-002 and -003 were renamed/removed from the catalog, but
        # CLAUDE.md still cites the whole block as a range. Before range
        # expansion this passed silently -- only the range's start ID
        # (CORE-RESP-001) was ever extracted and checked.
        (repo / CATALOG_REL).write_text(
            "# Catalog\n\n- CORE-RESP-001\n- CORE-RESP-004\n", encoding="utf-8"
        )
        (repo / "CLAUDE.md").write_text("CORE-RESP-001..004", encoding="utf-8")
        assert main(["--root", str(repo)]) == 1
        err = capsys.readouterr().err
        assert "CORE-RESP-002" in err
        assert "CORE-RESP-003" in err

    def test_orphans_clean_message(self, repo: Path, capsys):
        (repo / "CLAUDE.md").write_text(
            "CORE-ARCH-009 CORE-SEC-008 CORE-TS-007", encoding="utf-8"
        )
        assert main(["--root", str(repo), "--orphans"]) == 0
        assert "every catalog rule is cited" in capsys.readouterr().err


class TestFindRepoRoot:
    def test_walks_up_to_the_catalog(self, repo: Path):
        nested = repo / "a" / "b"
        nested.mkdir(parents=True)
        assert find_repo_root(nested) == repo

    def test_falls_back_to_start_when_absent(self, tmp_path: Path):
        assert find_repo_root(tmp_path) == tmp_path


class TestRealRepo:
    """The gate must be green against the actual repository.

    A bare `main(...) == 0` assertion here is vacuous: if a CITING_SOURCES
    glob silently stopped matching anything (a moved file, a typo'd
    pattern), or the catalog parse regressed to finding zero IDs,
    `collect_citations` would return `{}` and the gate would report "no
    unknown IDs" with nothing actually checked -- passing for the wrong
    reason. The non-triviality assertions below force the test to fail if
    that ever happens, rather than passing regardless of whether the gate
    is doing real work.
    """

    def test_no_unknown_ids_in_this_repo(self):
        root = find_repo_root(Path(__file__).resolve().parent)
        assert (root / CATALOG_REL).is_file()

        catalog_ids = collect_catalog_ids(root)
        citations = collect_citations(root)

        # Non-triviality: the real catalog has 60+ rules and several real
        # files cite them. If either collection came back empty or tiny,
        # the gate isn't actually checking anything.
        assert len(catalog_ids) > 50
        assert citations, "expected at least one real citing file to be found"
        assert sum(len(ids) for ids in citations.values()) > 20

        assert main(["--root", str(root)]) == 0
