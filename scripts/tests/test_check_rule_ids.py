"""Tests for scripts/check_rule_ids.py — the CORE-* citation gate.

The gate exists because PinPoint states its rules in several hand-written
places (catalog, CLAUDE.md, AGENTS.md, REVIEW.md, .claude/rules/) that are
deliberately NOT generated from one source. It catches the drift that bites:
a rule renamed or deleted while citations linger, and (PP-22e4) a fragile
"rule N" / "AGENTS.md §2.1" citation that a future restructuring of AGENTS.md
would turn into a pointer to nothing.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from check_rule_ids import (  # noqa: E402
    CITING_SOURCES,
    collect_catalog_ids,
    collect_citations,
    collect_descending_ranges,
    collect_legacy_citations,
    collect_section_titles,
    collect_unresolved_section_titles,
    extract_ids,
    find_descending_ranges,
    find_legacy_citations,
    find_repo_root,
    find_unresolved_section_titles,
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
        # Citing files reference contiguous blocks as e.g. CORE-RESP-001..004
        # instead of spelling out every ID. Without expansion, only the
        # range's start ID is ever extracted -- the end ID and every
        # interior ID are silently never checked against the catalog.
        assert extract_ids("CORE-RESP-001..004") == {
            "CORE-RESP-001",
            "CORE-RESP-002",
            "CORE-RESP-003",
            "CORE-RESP-004",
        }

    def test_expands_descending_range_shorthand(self):
        # A backwards citation like CORE-RESP-004..001 (e.g. from an edit
        # that swapped the endpoints by mistake) must still expand to the
        # full span -- range(4, 2) is empty, so before sorting the endpoints
        # this silently produced only the start ID and never checked 001-003
        # against the catalog.
        assert extract_ids("CORE-RESP-004..001") == {
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


class TestFindDescendingRanges:
    def test_flags_backwards_range(self):
        assert find_descending_ranges("CORE-RESP-004..001") == ["CORE-RESP-004..001"]

    def test_ascending_range_is_not_flagged(self):
        assert find_descending_ranges("CORE-RESP-001..004") == []

    def test_no_range_is_not_flagged(self):
        assert find_descending_ranges("CORE-ARCH-009") == []


class TestFindLegacyCitations:
    def test_finds_numbered_rule_citation(self):
        assert find_legacy_citations("see AGENTS.md rule 10 for the reason") == [
            (1, "AGENTS.md rule 10")
        ]

    def test_finds_bare_rule_citation_without_agents_md_prefix(self):
        # PP-22e4 found several of these mid-sentence with no "AGENTS.md" in
        # sight -- still a fragile pointer into the numbered list.
        assert find_legacy_citations("Email is never persisted (rule 10).") == [
            (1, "rule 10")
        ]

    def test_finds_commandment_form(self):
        assert find_legacy_citations("AGENTS.md commandment #12") == [
            (1, "AGENTS.md commandment #12")
        ]

    def test_finds_section_21_citation(self):
        assert find_legacy_citations('AGENTS.md §2.1 "Progressive Enhancement"') == [
            (1, "AGENTS.md §2.1")
        ]

    def test_finds_any_top_level_section_citation(self):
        # PP-z9m1 widened this from §2.1 alone to every section number: the
        # numbering shifts whenever AGENTS.md gains or loses a section and
        # nothing tells the citation.
        assert find_legacy_citations("See AGENTS.md §7 for the pooler table") == [
            (1, "AGENTS.md §7")
        ]

    def test_finds_multi_level_section_citation(self):
        # "§2.2.5" is not a section at all -- it is item 5 of a numbered list
        # under §2.2. Three sites cited it before PP-z9m1, so the pattern has
        # to reach arbitrary depth rather than stopping at N.N.
        assert find_legacy_citations("root checkout (AGENTS.md §2.2.5)") == [
            (1, "AGENTS.md §2.2.5")
        ]

    def test_ignores_bare_section_mark_without_agents_md(self):
        # docs/pbm-listing-redesign-refresher.md numbers its OWN sections and
        # refers to them as "§7"/"§11". Those are not AGENTS.md citations and
        # must not trip the gate.
        assert (
            find_legacy_citations("amended 2026-07-25 (§7). Build state is §11.") == []
        )

    def test_accepts_the_durable_heading_title_form(self):
        # The replacement form this gate is steering people toward.
        assert find_legacy_citations('per AGENTS.md "Which tests to run"') == []

    def test_tolerates_backtick_between_filename_and_keyword(self):
        # `AGENTS.md` §2.1 -- code-fenced filename immediately followed by
        # the section mark broke a naive "AGENTS\.md\s*§2\.1" regex on main
        # (docs/NON_NEGOTIABLES.md's own sync-contract line had this shape).
        assert find_legacy_citations("see `AGENTS.md` §2.1 for the index") == [
            (1, "AGENTS.md` §2.1")
        ]

    def test_ignores_core_id_citations(self):
        assert find_legacy_citations("Email privacy (CORE-SEC-007).") == []

    def test_ignores_rule_of_three_prose(self):
        # "Rule" followed by a word, not a number, must not match.
        assert find_legacy_citations("Rule of Three before abstracting") == []

    def test_ignores_heading_ending_in_rule_above_an_ordered_list(self):
        # A citation lives on one line. Matching across a newline would make
        # every markdown heading that ends in "rule" followed by an ordered
        # list -- .claude/rules/README.md's "Adding or changing a rule" -- read
        # as a citation of "rule 1".
        assert (
            find_legacy_citations("## Adding or changing a rule\n\n1. State it") == []
        )

    def test_finds_citation_hard_wrapped_between_keyword_and_number(self):
        # The scanned surfaces are hand-wrapped at ~78 columns, so a citation
        # can land with the keyword ending one line and the number opening the
        # next. Horizontal-whitespace-only matching misses it by construction.
        text = "It is forbidden by AGENTS.md rule\n12 and always has been.\n"
        assert find_legacy_citations(text) == [
            (1, "AGENTS.md rule 12 and always has been.")
        ]

    def test_wrapped_form_ignores_heading_above_an_ordered_list(self):
        # Same shape as the wrapped citation except for the blank line, which
        # is exactly what separates a markdown heading + list from a sentence
        # that wrapped. This is .claude/rules/README.md's own text.
        assert (
            find_legacy_citations("## Adding or changing a rule\n\n1. State it") == []
        )

    def test_wrapped_form_ignores_heading_directly_above_a_number(self):
        # Belt and braces: even with no blank line, a heading is never a
        # wrapped sentence.
        assert find_legacy_citations("## Adding or changing a rule\n1. State it") == []

    def test_wrapped_form_requires_the_number_on_the_next_line(self):
        # A keyword at end of line with prose under it is not a citation.
        assert find_legacy_citations("something about a rule\nand more prose") == []

    def test_reports_correct_line_number(self):
        text = "line one\nline two\nAGENTS.md rule 9 here\n"
        assert find_legacy_citations(text) == [(3, "AGENTS.md rule 9")]

    def test_reports_multiple_hits_in_order(self):
        text = "AGENTS.md rule 5\nAGENTS.md §2.1\n"
        assert find_legacy_citations(text) == [
            (1, "AGENTS.md rule 5"),
            (2, "AGENTS.md §2.1"),
        ]


class TestCollectLegacyCitations:
    def test_collects_from_agents_md(self, repo: Path):
        (repo / "AGENTS.md").write_text("see rule 10", encoding="utf-8")
        assert collect_legacy_citations(repo) == {"AGENTS.md": [(1, "rule 10")]}

    def test_collects_from_source_tree(self, repo: Path):
        src = repo / "src" / "lib"
        src.mkdir(parents=True)
        (src / "example.ts").write_text(
            "// Email is never persisted (rule 10).", encoding="utf-8"
        )
        assert collect_legacy_citations(repo) == {
            "src/lib/example.ts": [(1, "rule 10")]
        }

    def test_clean_tree_returns_empty(self, repo: Path):
        (repo / "AGENTS.md").write_text(
            "see CORE-SEC-007 (email privacy)", encoding="utf-8"
        )
        assert collect_legacy_citations(repo) == {}

    def test_dated_records_are_not_scanned(self, repo: Path):
        # docs/superpowers/ and friends are historical records (AGENTS.md
        # §8) and are not in LEGACY_CITATION_SOURCES at all -- a rule-number
        # citation there must not surface, unlike a real source file.
        specs = repo / "docs" / "superpowers" / "specs"
        specs.mkdir(parents=True)
        (specs / "2026-05-01-old-design.md").write_text(
            "per AGENTS.md rule #16", encoding="utf-8"
        )
        assert collect_legacy_citations(repo) == {}

    def test_self_excludes_its_own_module(self, repo: Path):
        # check_rule_ids.py and its test necessarily spell out example
        # citation forms in prose/docstrings while documenting the pattern
        # this check bans -- they must not trigger against themselves.
        scripts = repo / "scripts"
        scripts.mkdir()
        (scripts / "check_rule_ids.py").write_text(
            "# e.g. AGENTS.md rule 10", encoding="utf-8"
        )
        assert collect_legacy_citations(repo) == {}


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

    def test_collect_descending_ranges_finds_citing_file(self, repo: Path):
        (repo / "CLAUDE.md").write_text("CORE-RESP-004..001", encoding="utf-8")
        assert collect_descending_ranges(repo) == {"CLAUDE.md": ["CORE-RESP-004..001"]}

    def test_collect_descending_ranges_finds_catalog(self, repo: Path):
        (repo / CATALOG_REL).write_text(
            "# Catalog\n\n- CORE-RESP-004..001\n", encoding="utf-8"
        )
        assert collect_descending_ranges(repo) == {CATALOG_REL: ["CORE-RESP-004..001"]}

    def test_collect_descending_ranges_clean_when_none(self, repo: Path):
        (repo / "CLAUDE.md").write_text("CORE-RESP-001..004", encoding="utf-8")
        assert collect_descending_ranges(repo) == {}


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

    def test_fails_on_legacy_rule_citation(self, repo: Path, capsys):
        (repo / "AGENTS.md").write_text(
            "email privacy is AGENTS.md rule 10", encoding="utf-8"
        )
        assert main(["--root", str(repo)]) == 4
        err = capsys.readouterr().err
        assert "AGENTS.md" in err
        assert "rule 10" in err
        assert "CORE-*" in err

    def test_fails_on_legacy_section_21_citation(self, repo: Path, capsys):
        (repo / "CLAUDE.md").write_text(
            'per AGENTS.md §2.1 "Progressive Enhancement"', encoding="utf-8"
        )
        assert main(["--root", str(repo)]) == 4
        err = capsys.readouterr().err
        assert "CLAUDE.md" in err

    def test_core_id_citation_does_not_trigger_legacy_check(self, repo: Path, capsys):
        # The fix for a legacy citation is a CORE-* ID -- confirm that form
        # passes clean rather than merely not being what we were testing for.
        (repo / "AGENTS.md").write_text(
            "localhost not 127.0.0.1 is CORE-SEC-008", encoding="utf-8"
        )
        assert main(["--root", str(repo)]) == 0

    def test_legacy_check_runs_before_unknown_id_check(self, repo: Path, capsys):
        # Both a legacy citation and an unknown CORE-* ID are present; the
        # legacy check (exit 4) must fire first so its more actionable
        # "cite the ID instead" guidance isn't masked by the ID-typo error.
        (repo / "AGENTS.md").write_text(
            "AGENTS.md rule 10 and CORE-ARCH-999", encoding="utf-8"
        )
        assert main(["--root", str(repo)]) == 4

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

    def test_fails_on_descending_range_in_citing_file(self, repo: Path, capsys):
        (repo / "CLAUDE.md").write_text("CORE-RESP-004..001", encoding="utf-8")
        assert main(["--root", str(repo)]) == 3
        err = capsys.readouterr().err
        assert "CLAUDE.md" in err
        assert "CORE-RESP-004..001" in err

    def test_fails_on_descending_range_in_catalog(self, repo: Path, capsys):
        (repo / CATALOG_REL).write_text(
            "# Catalog\n\n- CORE-RESP-004..001\n", encoding="utf-8"
        )
        assert main(["--root", str(repo)]) == 3
        err = capsys.readouterr().err
        assert CATALOG_REL in err
        assert "CORE-RESP-004..001" in err

    def test_orphans_clean_message(self, repo: Path, capsys):
        (repo / "CLAUDE.md").write_text(
            "CORE-ARCH-009 CORE-SEC-008 CORE-TS-007", encoding="utf-8"
        )
        assert main(["--root", str(repo), "--orphans"]) == 0
        assert "every catalog rule is cited" in capsys.readouterr().err

    def test_fails_on_unknown_id_in_review_md(self, repo: Path, capsys):
        """Regression: CITING_SOURCES once named `CODE_REVIEW.md` (the
        pre-PP-22e4 design-spec filename) while the file that actually
        shipped is `REVIEW.md`. "Missing paths are fine" made that a silent
        no-op -- the nine CORE-* citations that live in REVIEW.md were never
        scanned, and a bogus ID there would pass clean. Plant one and require
        the gate to catch it.
        """
        (repo / "REVIEW.md").write_text("CORE-ARCH-999 is fake", encoding="utf-8")
        assert main(["--root", str(repo)]) == 1
        err = capsys.readouterr().err
        assert "CORE-ARCH-999" in err
        assert "REVIEW.md" in err

    def test_fails_on_unknown_id_in_agents_rules(self, repo: Path, capsys):
        (repo / ".agents" / "rules").mkdir(parents=True)
        (repo / ".agents" / "rules" / "antigravity.md").write_text(
            "CORE-ARCH-999 is fake", encoding="utf-8"
        )
        assert main(["--root", str(repo)]) == 1
        err = capsys.readouterr().err
        assert "CORE-ARCH-999" in err
        assert ".agents/rules/antigravity.md" in err


class TestFindRepoRoot:
    def test_walks_up_to_the_catalog(self, repo: Path):
        nested = repo / "a" / "b"
        nested.mkdir(parents=True)
        assert find_repo_root(nested) == repo

    def test_falls_back_to_start_when_absent(self, tmp_path: Path):
        assert find_repo_root(tmp_path) == tmp_path


class TestSectionTitleResolution:
    """Banning section numbers is only an improvement if the replacement
    resolves. These cover the check that makes that true."""

    TITLES = {"Deployment", "Which tests to run", "Lint engines (and the mirror)"}

    def test_exact_title_resolves(self):
        assert (
            find_unresolved_section_titles('see AGENTS.md "Deployment"', self.TITLES)
            == []
        )

    def test_backticked_filename_resolves(self):
        text = 'see `AGENTS.md` "Which tests to run" first'
        assert find_unresolved_section_titles(text, self.TITLES) == []

    def test_prefix_of_a_glossed_heading_resolves(self):
        # `### Lint engines (and the mirror)` is cited as "Lint engines" --
        # requiring the gloss verbatim would churn every citation when the
        # gloss is reworded.
        text = 'per AGENTS.md "Lint engines"'
        assert find_unresolved_section_titles(text, self.TITLES) == []

    def test_renamed_heading_is_reported(self):
        text = 'per AGENTS.md "Deployments"\n'
        assert find_unresolved_section_titles(text, self.TITLES) == [(1, "Deployments")]

    def test_reports_the_line_number(self):
        text = 'intro\n\nsee AGENTS.md "Nowhere"\n'
        assert find_unresolved_section_titles(text, self.TITLES) == [(3, "Nowhere")]

    def test_adjacent_string_literal_is_not_a_citation(self):
        # `(root / "AGENTS.md").write_text("x")` -- the quote after the
        # filename closes the literal; it does not open a cited title.
        text = '(root / "AGENTS.md").write_text("x")'
        assert find_unresolved_section_titles(text, self.TITLES) == []

    def test_collect_section_titles_strips_numeric_prefixes(self, repo: Path):
        (repo / "AGENTS.md").write_text(
            "# Top\n\n## 7. Deployment\n\n### 2.2 Process rules\n\n### Branches\n",
            encoding="utf-8",
        )
        assert collect_section_titles(repo) == {
            "Deployment",
            "Process rules",
            "Branches",
        }

    def test_main_fails_on_unresolvable_title(self, repo: Path, capsys):
        (repo / "AGENTS.md").write_text("# A\n\n## 7. Deployment\n", encoding="utf-8")
        (repo / "CLAUDE.md").write_text(
            'never db:reset (AGENTS.md "Deployments")\n', encoding="utf-8"
        )
        assert main(["--root", str(repo)]) == 5
        assert "Deployments" in capsys.readouterr().err

    def test_main_passes_when_the_title_resolves(self, repo: Path):
        (repo / "AGENTS.md").write_text("# A\n\n## 7. Deployment\n", encoding="utf-8")
        (repo / "CLAUDE.md").write_text(
            'never db:reset (AGENTS.md "Deployment")\n', encoding="utf-8"
        )
        assert main(["--root", str(repo)]) == 0

    def test_missing_agents_md_is_not_a_failure(self, repo: Path):
        (repo / "CLAUDE.md").write_text('AGENTS.md "Anything"\n', encoding="utf-8")
        assert collect_unresolved_section_titles(repo) == {}


class TestWordAndWrappedSectionForms:
    """The spellings PP-z9m1's first sweep left behind."""

    def test_finds_the_spelled_out_section_form(self):
        assert find_legacy_citations("per AGENTS.md section 3") == [
            (1, "AGENTS.md section 3")
        ]

    def test_finds_capitalised_section_form(self):
        assert find_legacy_citations("AGENTS.md Section 5 covers it") == [
            (1, "AGENTS.md Section 5")
        ]

    def test_finds_a_hard_wrapped_section_citation(self):
        # A comment block wrapped at ~78 columns, continuation line opening
        # with the comment marker.
        text = "# citations, per AGENTS.md\n# §8. Add a path here only when\n"
        assert find_legacy_citations(text) == [
            (1, "AGENTS.md # \u00a78. Add a path here only when")
        ]

    def test_bare_filename_at_end_of_line_is_not_a_citation(self):
        text = "the durable target is AGENTS.md\nand nothing else.\n"
        assert find_legacy_citations(text) == []


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

        # No descending ranges exist today either.
        assert collect_descending_ranges(root) == {}

        # PP-22e4 converted every legacy rule-number/§2.1 citation in scope
        # to a CORE-* ID; none should have crept back in.
        assert collect_legacy_citations(root) == {}

        # PP-z9m1 converted every section-number citation to a heading title.
        # Non-triviality: the conversion left 40+ real title citations, so an
        # empty result would mean the title regex stopped matching rather than
        # that every title resolves.
        titles = collect_section_titles(root)
        assert len(titles) > 20
        assert collect_unresolved_section_titles(root) == {}

        assert main(["--root", str(root)]) == 0

    def test_citing_sources_literals_exist_on_disk(self):
        """Every non-glob CITING_SOURCES entry must resolve to a real file.

        Glob entries (e.g. `.claude/rules/*.md`) are exempt on purpose --
        several of them are declared ahead of the file existing (PP-22e4
        lands `.claude/rules/` in a later PR), and "missing paths are fine"
        for those. A literal filename has no such excuse: if it's wrong, the
        gate silently checks nothing for that file, which is exactly the bug
        this module's REVIEW.md regression test above catches for one
        specific case. This test would have caught it directly.
        """
        root = find_repo_root(Path(__file__).resolve().parent)
        for pattern in CITING_SOURCES:
            if "*" in pattern:
                continue
            assert (root / pattern).is_file(), (
                f"CITING_SOURCES entry {pattern!r} does not exist on disk"
            )
