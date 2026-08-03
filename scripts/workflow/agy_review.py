#!/usr/bin/env python3
"""Post an automated code review on a PR using the Antigravity CLI (`agy`).

Usage: ./scripts/workflow/agy_review.py [--pro | --model M] [--dry-run]
                                        [--keep-worktree] [--verbose] <PR_NUMBER>

  --pro            Use gemini-3.1-pro-high instead of the flash default.
  --model M        Use an explicit agy model id (overrides --pro).
  --dry-run        Summarise what would be posted and exit. Posts nothing,
                   writes no marker.
  --keep-worktree  Leave the ephemeral checkout on disk for debugging.
  --verbose        Echo the prompt and the raw agy envelope.
  --at SHA         Replay an earlier commit of the PR (forces --dry-run). For
                   measuring detection against a head whose findings are known.

`agy` is the reviewer; this script is the only thing that talks to GitHub. It checks the
PR head into a throwaway worktree, lets agy loose in it, validates what comes back, posts
the findings as an inline review, and only then writes the SHA-pinned marker that
`_pr-gates.sh` accepts.

## What agy gets, and why

Reads, and nothing else. A checkout of the head commit, each changed file's diff sitting
beside it as `<file>.agy-diff.patch`, and `AGY_REVIEW_BRIEF.md` at the root carrying the
PR's title, author and current description plus the line ranges a finding may anchor to.

The procedure lives in `.agents/skills/pinpoint-agy-review/SKILL.md`, which the prompt
names explicitly — skills do NOT auto-activate in headless `-p` mode (measured: matching
on the skill description never fires), so the prompt stays four lines and everything
reviewable is a version-controlled file.

A middle version of this script gave agy a real shell and a curated command allow-list.
That is abandoned, on evidence:

- **A denied command ends the run.** Not "the model is told no and adapts" — the CLI
  shuts the conversation stream down and returns `status: SUCCESS` with an empty
  response. One denial cost a 52-step review of PR #1810. Upstream documents the
  opposite ("the run continues, exits 0"); it does not.
- **Some commands cannot be allowed at all.** A `git diff` scoped to a path containing
  square brackets is refused even with `command(git)` allowed — bracketed pathspecs
  defeat any multi-token rule, and PinPoint's dynamic route segments are full of them.
- **The deny list is not a boundary.** A broader allow silently overrides a narrower
  deny: with `command(git)` allowed, `git branch` and `git gc` ran despite explicit deny
  rules. Documented precedence is "Deny > Ask > Allow"; measured behaviour is not.

So the permission profile is the one shape that cannot trip the tripwire:

    "permissions": {
      "allow": ["read_file(*)"],
      "deny":  ["command(*)", "write_file(*)"]
    }

Subagents still work under it (verified) — the skill fans the review out across them,
one per changed file, which is how a large PR stays reviewable.

Two things this costs, stated plainly: agy cannot consult git history, and cannot run
`pnpm run check` to test a claim. Both were available in the shell version, and that
version found strictly less than this one.

`trustedWorkspaces` must contain `~/.cache/pinpoint/agy-review`, or agy refuses the
review checkout as an untrusted workspace. `agy-permissions.reference.json` beside this
script records the profile; settings.json is global to the host and is not managed from
this repo. `./scripts/workflow/agy_denied.py` reports anything agy tried to run anyway.

## The one guard that cannot be relaxed

agy confabulates. Handed a diff it could not read, it once emitted a confident, detailed
review of a *completely different PR* with an empty findings array — a false clean pass,
the one failure mode a review gate cannot tolerate.

So every response must carry a `proof` object echoing facts about the diff, checked here
against ground truth, after EVERY response including retries. A mismatch is fatal: no
review, no marker. That check is why the marker can be trusted.

A related measured behaviour: **agy exits 0 even when it produced nothing usable.**
Validity is judged from the response envelope, never from the exit code.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

FLASH_MODEL = "gemini-3.6-flash-high"
PRO_MODEL = "gemini-3.1-pro-high"

# Review comments post under Tim's account (`gh` is authed as timothyfroehlich), not a
# bot identity, so every comment is signed to distinguish an agy finding from one Tim
# wrote by hand.
SIGNATURE = "—Antigravity"

# SHA-pinned marker recognised by `_pr-gates.sh`'s `reviewed` gate, alongside
# `<!-- pinpoint-claude-review: -->`. The SHA pin makes it self-expiring: a later push
# changes head and re-arms the gate.
MARKER_PREFIX = "<!-- pinpoint-agy-review:"

# The review depth lives in its own comment beside the SHA marker (PP-9onv). agy records
# its tier rather than a `/code-review` level, so nothing in the record can be read as a
# depth Tim ran — `depth_phrase` in merge-handoff.sh renders `agy-*` accordingly.
DEPTH_PREFIX = "<!-- pinpoint-review-depth:"
MODEL_DEPTHS = {FLASH_MODEL: "agy-flash", PRO_MODEL: "agy-pro"}

# agy refuses a workspace outside `trustedWorkspaces`, so review checkouts live under a
# single stable parent that is trusted once rather than in a per-run temp dir.
WORKTREE_PARENT = Path.home() / ".cache" / "pinpoint" / "agy-review"

MAX_LINE_RETRIES = 2

# Wall-clock ceiling on one agy invocation, a little over its own `--print-timeout 15m`.
AGY_TIMEOUT_SECONDS = 16 * 60

RESPONSE_SCHEMA = {
    "type": "object",
    "required": ["verdict", "summary", "findings", "proof"],
    "properties": {
        # A one-word ship/no-ship call. It does not drive the merge gate — unresolved
        # threads and the marker do that — but it makes an empty `findings` array legible:
        # `approve` says "I looked and found nothing", which is a different claim from a
        # review that simply failed to produce findings.
        "verdict": {"type": "string", "enum": ["approve", "needs-attention"]},
        "summary": {"type": "string"},
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "required": [
                    "path",
                    "line",
                    "side",
                    "severity",
                    "confidence",
                    "rule",
                    "body",
                ],
                "properties": {
                    "path": {"type": "string"},
                    "line": {"type": "integer"},
                    "side": {"type": "string", "enum": ["RIGHT"]},
                    "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                    # Self-reported, and the reviewer cannot run anything to check its own
                    # claim, so a finding that rests on an unread caller should say 0.5
                    # rather than round up. Rendered beside the severity so the reader can
                    # triage; never used to silently drop a finding.
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "rule": {"type": ["string", "null"]},
                    "body": {"type": "string"},
                },
            },
        },
        "proof": {
            "type": "object",
            "required": ["files_changed", "first_diff_line"],
            "properties": {
                "files_changed": {"type": "integer"},
                "first_diff_line": {"type": "string"},
            },
        },
    },
}


class ReviewError(RuntimeError):
    """Fatal: the review did not happen. Nothing is posted, no marker is written."""


# ---------------------------------------------------------------------------
# Pure functions (unit-tested in scripts/tests/test_agy_review.py)
# ---------------------------------------------------------------------------

_DIFF_HEADER = re.compile(r"^diff --git a/(?P<old>.+?) b/(?P<new>.+)$")
_HUNK_HEADER = re.compile(r"^@@ -\d+(?:,\d+)? \+(?P<start>\d+)(?:,(?P<count>\d+))? @@")


def parse_diff_hunks(diff_text):
    """Map each file in a unified diff to the RIGHT-side line numbers it covers.

    GitHub only accepts an inline review comment on a line present in that file's diff
    hunks; a single out-of-range line 422s the entire review POST and nothing lands. So
    every finding is checked against this map before anything is sent.

    Both added (`+`) and context (` `) lines advance the right-side counter and are
    valid anchors. Removed (`-`) lines do not exist on the right side and are skipped.
    """
    hunks = {}
    current = None
    right_line = 0
    # Only lines INSIDE a hunk are payload. Without this flag the `+++ b/path` file
    # header parses as an added line and injects a bogus line 0 into every new file.
    in_hunk = False

    for raw in diff_text.splitlines():
        header = _DIFF_HEADER.match(raw)
        if header:
            current = header.group("new")
            hunks.setdefault(current, set())
            right_line = 0
            in_hunk = False
            continue

        if current is None:
            continue

        hunk = _HUNK_HEADER.match(raw)
        if hunk:
            right_line = int(hunk.group("start"))
            in_hunk = True
            continue

        if not in_hunk:
            continue

        if raw.startswith("+"):
            hunks[current].add(right_line)
            right_line += 1
        elif raw.startswith("-"):
            continue
        elif raw.startswith(" "):
            hunks[current].add(right_line)
            right_line += 1

    return hunks


def diff_proof(diff_text):
    """Ground-truth facts a run must echo back to prove it read the diff.

    Deliberately cheap to verify and impossible to guess: the exact text of the first
    `diff --git` line, and how many files the diff touches.
    """
    lines = diff_text.splitlines()
    first = next((line for line in lines if line.startswith("diff --git ")), "")
    return {
        "files_changed": sum(1 for line in lines if line.startswith("diff --git ")),
        "first_diff_line": first,
    }


def verify_proof(claimed, actual):
    """Return a list of human-readable mismatches; empty means the run read the diff."""
    problems = []
    if not isinstance(claimed, dict):
        return ["proof is missing or not an object"]
    if claimed.get("files_changed") != actual["files_changed"]:
        problems.append(
            f"proof.files_changed={claimed.get('files_changed')!r} "
            f"but the diff touches {actual['files_changed']} file(s)"
        )
    if (claimed.get("first_diff_line") or "").strip() != actual[
        "first_diff_line"
    ].strip():
        problems.append(
            f"proof.first_diff_line={claimed.get('first_diff_line')!r} "
            f"but the diff starts with {actual['first_diff_line']!r}"
        )
    return problems


def _format_ranges(lines):
    """Collapse a set of line numbers into compact `12-34, 58-72` ranges for an error."""
    if not lines:
        return "(none — this file has no right-side lines in the diff)"
    ordered = sorted(lines)
    spans = []
    start = prev = ordered[0]
    for value in ordered[1:]:
        if value == prev + 1:
            prev = value
            continue
        spans.append((start, prev))
        start = prev = value
    spans.append((start, prev))
    return ", ".join(str(a) if a == b else f"{a}-{b}" for a, b in spans)


def validate_findings(findings, hunks):
    """Return per-finding errors precise enough for agy to correct itself.

    A finding is never silently demoted into the summary body: a demoted finding creates
    no review thread, and a finding with no thread cannot block the `threads` gate. So an
    unanchorable finding is an error to be fixed, not a comment to be relocated.
    """
    errors = []
    for index, finding in enumerate(findings):
        path = finding.get("path")
        line = finding.get("line")
        if path not in hunks:
            errors.append(
                f"findings[{index}]: {path!r} is not a file in the diff. "
                f"Files in the diff: {', '.join(sorted(hunks)) or '(none)'}."
            )
            continue
        if line not in hunks[path]:
            errors.append(
                f"findings[{index}]: {path}:{line} is not in the diff. "
                f"Valid RIGHT-side lines for that file: {_format_ranges(hunks[path])}."
            )
    return errors


def _finding_prefix(finding):
    """Lead each inline comment with severity, rule and self-reported confidence.

    Confidence is on the comment rather than only in the JSON because the reviewer cannot
    run anything to check its own claim — a finding that rests on a caller it never read
    should be visibly less certain than one read straight off the line it points at, and
    the person triaging threads is the one who needs that.
    """
    bits = [finding["severity"]]
    if finding.get("rule"):
        bits.append(finding["rule"])
    confidence = finding.get("confidence")
    if isinstance(confidence, (int, float)):
        bits.append(f"confidence {confidence:.0%}")
    return f"**{' · '.join(bits)}**\n\n"


def build_review_payload(result, head_sha, head_moved_to=None):
    """Assemble the GitHub review POST body.

    `event` is COMMENT because GitHub rejects APPROVE/REQUEST_CHANGES on your own PR and
    `gh` is authed as the same account that opens them.
    """
    body = result["summary"]

    # `.get` rather than `[...]`: the retry continuation carries no schema, so a second
    # response can legitimately arrive without a verdict. A missing one is rendered as
    # nothing rather than guessed at — inventing "approve" here would be the one lie this
    # whole script is built to prevent.
    verdict = result.get("verdict")
    if verdict in {"approve", "needs-attention"}:
        label = (
            "✅ **approve** — no material findings"
            if verdict == "approve"
            else "⚠️ **needs attention**"
        )
        body = f"{label}\n\n{body}"

    if head_moved_to:
        body = (
            f"> ⚠️ **The branch moved during this review.** These findings cover "
            f"`{head_sha[:7]}`, but head is now `{head_moved_to[:7]}`. The review marker "
            f"pins the reviewed commit, so the `reviewed` gate will report `stale_marker` "
            f"until the new head is reviewed.\n\n" + body
        )

    comments = [
        {
            "path": finding["path"],
            "line": finding["line"],
            "side": finding["side"],
            "body": f"{_finding_prefix(finding)}{finding['body']}\n\n{SIGNATURE}",
        }
        for finding in result["findings"]
    ]

    return {
        "commit_id": head_sha,
        "event": "COMMENT",
        "body": f"{body}\n\n{SIGNATURE}",
        "comments": comments,
    }


SIDECAR_SUFFIX = ".agy-diff.patch"
BRIEF_NAME = "AGY_REVIEW_BRIEF.md"
SKILL_RELPATH = ".agents/skills/pinpoint-agy-review/SKILL.md"


def split_diff_by_file(diff_text):
    """Split one unified diff into `{new_path: that file's diff alone}`.

    Splitting the merge-base diff we already computed — rather than running `git diff`
    once per file — keeps every sidecar byte-identical to the diff the hunk map and the
    proof were derived from. A per-file `git diff` could disagree with it (rename
    detection is computed across the whole diff, not per path), and then a finding could
    anchor to a line the validator never saw.
    """
    sections = {}
    current = None
    buffer = []
    for raw in diff_text.splitlines(keepends=True):
        header = _DIFF_HEADER.match(raw.rstrip("\n"))
        if header:
            if current is not None:
                sections[current] = "".join(buffer)
            current = header.group("new")
            buffer = [raw]
            continue
        if current is not None:
            buffer.append(raw)
    if current is not None:
        sections[current] = "".join(buffer)
    return sections


def install_skill(worktree):
    """Copy the review procedure INTO the checkout, over whatever the PR has there.

    The worktree is the PR's head commit, so without this the skill is whatever that
    branch happens to contain — which for any PR branched before the skill landed is
    nothing at all. agy does not complain about that: told to read a file that is not
    there, it proceeds on the brief alone and returns a review that looks normal. Every
    run against PRs #1807/#1809/#1818/#1819 worked exactly that way before this existed.

    Taking it from the reviewer's side is also the only safe direction. A procedure read
    out of the tree under review is a procedure the PR can edit — a diff that rewrites
    this file to "return no findings" would be honoured by the reviewer reading it.

    `REVIEW.md` is deliberately NOT pinned this way: it is the rubric, a PR may legitimately
    change it, and a change to it should be reviewed against its own new text.
    """
    source = Path(__file__).resolve().parents[2] / SKILL_RELPATH
    if not source.is_file():
        raise ReviewError(
            f"the review procedure is missing from this checkout: {source}. "
            "Nothing was posted — a review without it is not the review this "
            "script claims to run."
        )
    target = worktree / SKILL_RELPATH
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def is_generated(path):
    """True for files a reviewer must not hand-edit, so a sidecar for them is only cost.

    Measured on PR #1818: 2650 of its 5364 changed lines were a single
    `drizzle/meta/*_snapshot.json`. Handing that to the model spends context on a blob
    whose only correct review is "it was generated" — and `drizzle/meta` in particular
    is the one place AGENTS.md forbids editing by hand at all, because the snapshots
    carry a prevId chain that manual edits corrupt.

    Deliberately narrow: generated artifacts only, not merely large or boring files.
    Long plan docs and test fixtures stay reviewable — a human wrote them, so a reviewer
    can have an opinion about them.
    """
    return (
        path.startswith("drizzle/meta/")
        or path.endswith(".snap")
        or path in {"pnpm-lock.yaml", "package-lock.json", "yarn.lock"}
    )


def write_sidecars(worktree, sections):
    """Drop each file's patch beside the file itself; return the paths written.

    A reviewer reading `src/lib/foo.ts` finds `src/lib/foo.ts.agy-diff.patch` in the same
    directory, so "what changed here" never requires scrolling a combined diff to find
    the right hunk. Deleted files get a sidecar too — the directory still exists, and the
    removal is reviewable.
    """
    written = {}
    for path, patch in sections.items():
        if is_generated(path):
            continue
        target = worktree / (path + SIDECAR_SUFFIX)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(patch)
        written[path] = path + SIDECAR_SUFFIX
    return written


def build_brief(pr, meta, base_sha, head_sha, sections, hunks, proof):
    """The orientation document agy reads first: what this PR claims to be, and where.

    The PR description is the thing a diff cannot supply — whether the change does what
    the author says is most of what a review is for, and without it the model can only
    check the code against itself.
    """
    body = (meta.get("body") or "").strip() or "_(no description)_"
    rows = []
    for path in sorted(sections):
        if is_generated(path):
            continue
        anchorable = _format_ranges(hunks.get(path, set()))
        rows.append(f"| `{path}` | `{path}{SIDECAR_SUFFIX}` | {anchorable} |")
    table = "\n".join(rows)

    # Name the skipped files rather than silently omitting them: a reviewer who can see
    # 14 files in the PR but 12 in this table would otherwise have to wonder whether the
    # other two were withheld or missed.
    generated = [p for p in sorted(sections) if is_generated(p)]
    generated_note = ""
    if generated:
        listed = "\n".join(f"- `{p}`" for p in generated)
        generated_note = (
            "\n## Generated — no patch written, do not review\n\n"
            "These changed, and are counted in `files_changed` below, but they are "
            "machine-generated. Regenerating them is the only correct edit, so there is "
            "nothing here to have an opinion about.\n\n" + listed + "\n"
        )

    return f"""# Review brief — PR #{pr}

**{meta.get("title", "(untitled)")}**
by {(meta.get("author") or {}).get("login", "unknown")} · {meta.get("url", "")}

- base (merge-base): `{base_sha}`
- head under review: `{head_sha}`

## What the author says this does

{body}

## Changed files

Each file has its diff against the merge-base beside it. The last column is the
set of right-side lines a finding may anchor to — anything outside it is rejected
by GitHub and takes the whole review down with it.

| file | its diff | anchorable lines |
| :--- | :------- | :--------------- |
{table}
{generated_note}
## proof (copy these back verbatim)

- `files_changed`: {proof["files_changed"]}
- `first_diff_line`: `{proof["first_diff_line"]}`
"""


def build_prompt(pr, head_sha):
    """Point agy at the skill and the brief. Everything else lives in those files.

    Skills do not auto-activate in headless `-p` mode — description matching simply does
    not fire (measured), so the skill has to be named in the prompt. That is the point:
    the prompt stays a stable four lines and the reviewable content lives in a file under
    version control, where it can be edited without touching this script.
    """
    return f"""Review pull request #{pr} of the PinPoint repository. Your working
directory is a checkout of its head commit ({head_sha[:7]}).

Read `{SKILL_RELPATH}` in this workspace and follow it exactly. It is the
procedure for this review — how the diffs are laid out, how to use subagents, how to
anchor findings, and what to return.

Start with `{BRIEF_NAME}` at the root, then `REVIEW.md`.

You have no shell. Every command is denied and one attempt ends the run, discarding
the review. Everything you need is a file read.
"""


def build_retry_prompt(errors):
    joined = "\n".join(f"- {error}" for error in errors)
    return (
        "Your previous response anchored findings to lines that GitHub will reject.\n\n"
        f"{joined}\n\n"
        "Re-emit the COMPLETE JSON object with those findings corrected. Keep every "
        "finding whose line was already valid, unchanged. If a finding genuinely cannot "
        "be anchored to a valid right-side line, drop it from `findings` and describe it "
        "in `summary` instead. Repeat the same `proof` values."
    )


# ---------------------------------------------------------------------------
# Shell / API helpers
# ---------------------------------------------------------------------------


def run(cmd, **kwargs):
    kwargs.setdefault("capture_output", True)
    kwargs.setdefault("text", True)
    kwargs.setdefault("check", True)
    return subprocess.run(cmd, **kwargs)  # noqa: S603


def gh_json(args):
    return json.loads(run(["gh", *args]).stdout)


def repo_slug():
    return run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]
    ).stdout.strip()


def head_sha_of(pr):
    return run(
        ["gh", "pr", "view", str(pr), "--json", "headRefOid", "--jq", ".headRefOid"]
    ).stdout.strip()


def _require_proof(result, actual_proof):
    """Fatal unless this response demonstrably read the diff it was handed.

    Called after EVERY agy response, not just the first: a retry replaces `result`
    wholesale, so verifying once would leave the guard bypassable by anything after it.
    """
    problems = verify_proof(result.get("proof"), actual_proof)
    if problems:
        raise ReviewError(
            "agy did not read the diff it was given — it appears to have answered "
            "from memory. Nothing posted.\n  " + "\n  ".join(problems)
        )
    return result


def render_findings_comment(result, head_sha, head_moved_to):
    """The whole review as one plain comment, for when inline anchoring is impossible.

    GitHub resolves `comments[].line` against the pull request's CURRENT diff, not against
    `commit_id`. So when head moves mid-review and the new head touched the same files,
    every anchor can fall outside the diff and the inline POST 422s as a batch — losing a
    review that is still worth reading. This renders it as prose instead: no threads, but
    nothing thrown away. The marker still pins the reviewed SHA, so the gate reports
    `stale_marker` either way.
    """
    lines = [
        f"⚠️ **Review of `{head_sha[:7]}`, which is no longer head** "
        f"(now `{head_moved_to[:7]}`). GitHub would not accept inline comments against "
        "the moved diff, so the findings are inlined below. Re-run the review on the new "
        "head to get resolvable threads.",
        "",
        result["summary"],
    ]
    if result["findings"]:
        lines += ["", "---", ""]
        for finding in result["findings"]:
            rule = finding.get("rule")
            tag = f" · `{rule}`" if rule else ""
            lines.append(
                f"**`{finding['path']}:{finding['line']}`** · "
                f"{finding.get('severity', '?')}{tag}\n\n{finding['body']}\n"
            )
    lines += ["", SIGNATURE]
    return "\n".join(lines)


def _extract_review_object(response):
    """Pull the review object out of agy's turn text, wherever in it that lands.

    `response` is the whole assistant turn, not a bare JSON document, and the object's
    position within it is not stable. Measured on real runs: PR #1818 put the object
    first and narration after it ("Extra data: line 2"), while PR #1809 narrated three
    lines of subagent progress and put the object last ("Expecting value: line 1"). Both
    were complete reviews thrown away by a parse anchored to the start of the string.

    So the discriminator is shape, not position: decode at every `{` and keep the last
    object carrying both `findings` and `proof`. Last, not first, because the closing
    object is the agent's final answer if it ever emits more than one. `strict=False`
    tolerates the raw newlines agy writes inside `summary` (upstream #702).

    Returns None when no such object exists — the caller turns that into a hard failure,
    since a review that cannot be parsed must never become a marker.
    """
    decoder = json.JSONDecoder(strict=False)
    found = None
    for index, char in enumerate(response):
        if char != "{":
            continue
        try:
            candidate, _end = decoder.raw_decode(response, index)
        except json.JSONDecodeError:
            continue
        if (
            isinstance(candidate, dict)
            and "findings" in candidate
            and "proof" in candidate
        ):
            found = candidate
    return found


def _require_shape(result):
    """Fail with a legible error rather than a KeyError on a malformed response.

    `--json-schema` constrains the first response, but the retry continuation is a plain
    follow-up prompt with no schema attached, so nothing guarantees its shape. A bare
    `result["findings"]` there raises KeyError, which neither handler in `main` catches —
    the caller gets a traceback instead of the script's own FAILED line.
    """
    if not isinstance(result, dict):
        raise ReviewError(f"agy returned {type(result).__name__}, expected an object")
    if not isinstance(result.get("findings"), list):
        raise ReviewError("agy response has no `findings` array")
    if not isinstance(result.get("summary"), str):
        raise ReviewError("agy response has no `summary` string")
    for index, finding in enumerate(result["findings"]):
        # `severity` is included: the schema constrains only the FIRST response, and the
        # summary print loop indexes it directly, so a retry omitting it would raise
        # KeyError — the exact failure this function exists to convert into a FAILED line.
        missing = [
            k for k in ("path", "line", "side", "severity", "body") if k not in finding
        ]
        if missing:
            raise ReviewError(f"findings[{index}] is missing {', '.join(missing)}")
    return result


def invoke_agy(
    pr, workspace, prompt, model, schema_path, conversation_id=None, verbose=False
):
    """Run agy and return (parsed_result, conversation_id).

    Validity is judged from the envelope's `status` and the parseability of `response`.
    agy's exit code is ignored: it exits 0 even on runs that produced nothing usable.
    """
    cmd = [
        "agy",
        "-p",
        prompt,
        "--model",
        model,
        "--output-format",
        "json",
        "--json-schema",
        str(schema_path),
        "--print-timeout",
        "15m",
    ]
    if conversation_id:
        cmd += ["--conversation", conversation_id]

    try:
        completed = subprocess.run(  # noqa: S603
            cmd,
            cwd=workspace,
            capture_output=True,
            text=True,
            check=False,
            # A wall-clock backstop over agy's own `--print-timeout`. If agy wedges rather
            # than honouring it, an unbounded run hangs here forever with the ephemeral
            # worktree still registered.
            timeout=AGY_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise ReviewError(
            f"agy did not return within {AGY_TIMEOUT_SECONDS}s. Nothing posted."
        ) from exc
    raw = completed.stdout.strip()
    # The envelope echoes the whole review back and can run to tens of KB. It goes to a
    # file so a failure is debuggable without re-running, but never to stdout unless
    # asked — this script is usually driven by an agent whose context it would flood.
    # Keyed by PR: two concurrent reviews are a plausible use, and a shared filename means
    # the envelope you inspect after a failure may belong to the other run.
    WORKTREE_PARENT.mkdir(parents=True, exist_ok=True)
    (WORKTREE_PARENT / f"pr-{pr}-{model}-agy-envelope.json").write_text(raw)
    if verbose:
        print(f"--- agy envelope ---\n{raw[:2000]}\n--- end ---", file=sys.stderr)

    if not raw:
        raise ReviewError(
            f"agy produced no output. stderr: {completed.stderr.strip()[:500]}"
        )

    try:
        envelope = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ReviewError(f"agy output was not JSON: {raw[:500]}") from exc

    if envelope.get("status") != "SUCCESS":
        raise ReviewError(f"agy status was {envelope.get('status')!r}: {raw[:500]}")

    response = envelope.get("response") or ""
    if not response.strip():
        # agy reports SUCCESS with an empty response when a tool call was refused: the
        # run does not continue as its docs claim, it ends. Its stderr names the exact
        # command and the rule that would allow it, so surface that instead of the
        # envelope — the envelope only says the response was not JSON, which sends you
        # looking for a parsing bug that isn't there.
        raise ReviewError(
            "agy returned an empty response — the run ended early, usually because a "
            "tool call was denied.\n  agy said: "
            + (completed.stderr.strip()[:500] or "(nothing on stderr)")
        )

    result = _extract_review_object(response)
    if result is None:
        raise ReviewError(
            "agy response contained no review object with `findings` and `proof`:\n"
            f"{response[:500]}"
        )

    return _require_shape(result), envelope.get("conversation_id")


def post_review(slug, pr, payload):
    proc = subprocess.run(  # noqa: S603
        [
            "gh",
            "api",
            "--method",
            "POST",
            f"repos/{slug}/pulls/{pr}/reviews",
            "--input",
            "-",
        ],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise ReviewError(f"posting the review failed: {proc.stderr.strip()[:800]}")
    return json.loads(proc.stdout)


def write_marker(slug, pr, head_sha, depth, summary):
    """Post or update the sticky SHA-pinned marker.

    Mirrors mark-claude-review.sh: one sticky comment, rewritten in place, laid out as
    `<sha marker>\\n<depth marker>\\n<visible line>`. `_marker_record` compares everything
    between the SHA prefix and `-->` to the head SHA by string equality, so the depth goes
    in its OWN comment — putting it inside the SHA marker would fail every `reviewed` gate.
    It reads the depth from the same body, so the two must stay in one comment.

    `depth` is `agy-flash` / `agy-pro`, never a `/code-review` level: `depth_phrase` in
    merge-handoff.sh renders `agy-*` as "no /code-review run", so the record cannot be
    misread as a review Tim performed.

    `jq -rs` (slurp) rather than gh's per-page `--jq`, so a marker sitting on page 2+ of a
    busy PR is still found and a duplicate is not posted.
    """
    body = (
        f"{MARKER_PREFIX} {head_sha} -->\n"
        f"{DEPTH_PREFIX} {depth} -->\n"
        f"agy review of head {head_sha[:7]} — {depth} — {summary}"
    )

    listing = run(
        ["gh", "api", "--paginate", f"repos/{slug}/issues/{pr}/comments"]
    ).stdout
    existing = subprocess.run(  # noqa: S603
        [
            "jq",
            "-rs",
            "--arg",
            "prefix",
            MARKER_PREFIX,
            # `// ""` guards a null body: jq exits 5 on `startswith(null)`, and because
            # this runs AFTER post_review that would leave the review posted, the marker
            # unwritten, and a retry posting a duplicate review.
            '[.[] | flatten | .[] | select((.body // "") | startswith($prefix))] | last.id // empty',
        ],
        input=listing,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()

    if existing:
        run(
            [
                "gh",
                "api",
                "--method",
                "PATCH",
                f"repos/{slug}/issues/comments/{existing}",
                "-f",
                f"body={body}",
                "--jq",
                ".html_url",
            ]
        )
    else:
        run(
            [
                "gh",
                "api",
                "--method",
                "POST",
                f"repos/{slug}/issues/{pr}/comments",
                "-f",
                f"body={body}",
                "--jq",
                ".html_url",
            ]
        )


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def review(pr, model, dry_run, keep_worktree, verbose, at=None):
    slug = repo_slug()
    meta = gh_json(
        [
            "pr",
            "view",
            str(pr),
            "--json",
            "headRefOid,baseRefName,title,body,url,author",
        ]
    )
    head_sha = meta["headRefOid"]
    base_ref = meta["baseRefName"]

    run(["git", "fetch", "origin", f"pull/{pr}/head"])

    if at:
        # Replay an earlier commit of this PR. The only way to measure detection rate is
        # against a diff whose real findings are already known, and those live in the
        # past — at a head someone has since reviewed and fixed. Forced to dry-run: a
        # review of a superseded commit must never post or write a marker.
        head_sha = run(["git", "rev-parse", at]).stdout.strip()
        dry_run = True
        print(f"replaying {head_sha[:7]} (forced dry-run)")

    print(f"PR #{pr} — head {head_sha[:7]}, base {base_ref}, model {model}")

    # Fetch the base branch too, and diff against what was JUST fetched rather than the
    # local remote-tracking ref. A stale `origin/main` gives an older merge-base, so the
    # diff contains already-merged code that is not in GitHub's diff for this PR — agy
    # then reviews it, anchors a finding to one of those lines, and the whole review POST
    # 422s (one out-of-diff comment rejects the batch). `--refmap=` keeps this read-only:
    # a plain fetch would fast-forward origin/<base> under other agents holding worktrees
    # of this same repo.
    run(["git", "fetch", "--refmap=", "origin", base_ref])
    base_sha = run(["git", "rev-parse", "FETCH_HEAD"]).stdout.strip()

    WORKTREE_PARENT.mkdir(parents=True, exist_ok=True)
    worktree = WORKTREE_PARENT / f"pr-{pr}"
    subprocess.run(  # noqa: S603
        ["git", "worktree", "remove", "--force", str(worktree)],
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "HUSKY": "0"},
    )
    shutil.rmtree(worktree, ignore_errors=True)
    # Unconditional, and after the remove: `~/.cache` is a legitimately wipeable location,
    # so the directory can vanish while git still has it registered — and then `add` fails
    # with "missing but already registered worktree" on every subsequent run for this PR.
    subprocess.run(  # noqa: S603
        ["git", "worktree", "prune"], capture_output=True, text=True, check=False
    )

    # HUSKY=0 skips .husky/post-checkout → worktree_setup.py, which would otherwise
    # allocate a Supabase slot, ports and an .env.local that a read-only review has no
    # use for and that leak if this exits uncleanly.
    run(
        ["git", "worktree", "add", "--detach", str(worktree), head_sha],
        env={**os.environ, "HUSKY": "0"},
    )

    try:
        diff_text = run(["git", "diff", "--merge-base", base_sha, head_sha]).stdout
        if not diff_text.strip():
            raise ReviewError(
                f"the diff against {base_ref} is empty — nothing to review"
            )

        hunks = parse_diff_hunks(diff_text)
        actual_proof = diff_proof(diff_text)
        print(
            f"diff: {actual_proof['files_changed']} file(s), "
            f"{sum(len(v) for v in hunks.values())} anchorable line(s)"
        )

        # Lay the change out in the tree instead of in the prompt: one patch beside each
        # file it belongs to, plus a brief carrying what a diff cannot — the PR's stated
        # intent. Both are read, not prompted, so the prompt stays short enough that the
        # model spends its context on the code.
        install_skill(worktree)

        sections = split_diff_by_file(diff_text)
        written = write_sidecars(worktree, sections)
        (worktree / BRIEF_NAME).write_text(
            build_brief(pr, meta, base_sha, head_sha, sections, hunks, actual_proof)
        )
        skipped = len(sections) - len(written)
        skipped_note = f" ({skipped} generated file(s) skipped)" if skipped else ""
        print(
            f"laid out: {len(written)} sidecar patch(es){skipped_note} + {BRIEF_NAME}"
        )

        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump(RESPONSE_SCHEMA, handle)
            schema_path = Path(handle.name)

        try:
            prompt = build_prompt(pr, head_sha)
            if verbose:
                print(f"--- prompt ---\n{prompt[:1500]}\n--- end ---", file=sys.stderr)

            result, conversation_id = invoke_agy(
                pr, worktree, prompt, model, schema_path, verbose=verbose
            )

            # Proof first: a confabulated run must never reach line validation, where its
            # invented findings would look merely malformed rather than fabricated.
            _require_proof(result, actual_proof)

            for attempt in range(MAX_LINE_RETRIES + 1):
                errors = validate_findings(result["findings"], hunks)
                if not errors:
                    break
                if attempt == MAX_LINE_RETRIES:
                    raise ReviewError(
                        f"agy could not anchor its findings after {MAX_LINE_RETRIES} "
                        "retries. Nothing posted.\n  " + "\n  ".join(errors)
                    )
                print(
                    f"retry {attempt + 1}: {len(errors)} finding(s) cite invalid lines"
                )
                # The retry prompt carries the errors, NOT the diff — it only works as a
                # continuation of the conversation that saw the diff. Without an id, agy
                # would start fresh on a context-free prompt and answer from memory, which
                # is the documented confabulation defect with the guard removed.
                if not conversation_id:
                    raise ReviewError(
                        "agy returned no conversation_id, so the retry cannot continue "
                        "the conversation that read the diff. Nothing posted."
                    )
                result, conversation_id = invoke_agy(
                    pr,
                    worktree,
                    build_retry_prompt(errors),
                    model,
                    schema_path,
                    conversation_id=conversation_id,
                    verbose=verbose,
                )
                # Re-verify every time. The retry replaces `result` wholesale, so checking
                # proof only on the first response leaves the one guard the design rests on
                # bypassable by any response after it.
                _require_proof(result, actual_proof)
        finally:
            schema_path.unlink(missing_ok=True)

        # Under --at the head has "moved" by construction — we chose an older commit
        # deliberately — so the warning would be noise on every calibration run.
        current_head = head_sha_of(pr)
        moved = None if at else (current_head if current_head != head_sha else None)
        if moved:
            print(f"WARNING: head moved {head_sha[:7]} → {moved[:7]} during the review")

        payload = build_review_payload(result, head_sha, moved)
        count = len(payload["comments"])
        print(f"findings: {count}")

        # The full payload is written to disk rather than printed. It embeds every
        # finding body and the summary, and this script is normally run by an agent whose
        # context the dump would otherwise fill for no benefit. `--verbose` opts in.
        log_path = WORKTREE_PARENT / f"pr-{pr}-{model}-payload.json"
        log_path.write_text(json.dumps(payload, indent=2))

        for finding in result["findings"]:
            rule = finding.get("rule") or "—"
            print(
                f"  {finding['severity']:<6} {rule:<16} {finding['path']}:{finding['line']}"
            )
        print(f"full payload: {log_path}")

        if dry_run:
            print("--- dry run, nothing posted ---")
            if verbose:
                print(json.dumps(payload, indent=2))
            return 0

        try:
            url = post_review(slug, pr, payload).get("html_url", "(no url)")
            print(f"posted: {url}")
        except ReviewError:
            if not moved:
                raise
            # Only reachable on the moved-head path, where anchors legitimately no longer
            # resolve. Any other rejection is a real bug and must stay fatal.
            print("inline anchors rejected against the moved diff — posting as prose")
            body = render_findings_comment(result, head_sha, moved)
            out = run(
                [
                    "gh",
                    "api",
                    "--method",
                    "POST",
                    f"repos/{slug}/issues/{pr}/comments",
                    "-f",
                    f"body={body}",
                    "--jq",
                    ".html_url",
                ]
            ).stdout.strip()
            print(f"posted (no threads): {out}")

        summary = (
            f"{count} finding(s) via {model}" if count else f"no findings via {model}"
        )
        write_marker(slug, pr, head_sha, MODEL_DEPTHS.get(model, "agy-other"), summary)
        print(f"marker written for {head_sha[:7]}")

        if count:
            print(
                "\nEvery inline thread must now be resolved — fix the code, or reply "
                "with a one-sentence decline signed —Claude, then resolve the thread. "
                "The `threads` gate blocks the merge until the count reaches zero."
            )
        return 0

    finally:
        if keep_worktree:
            print(f"worktree kept at {worktree}")
        else:
            subprocess.run(  # noqa: S603
                ["git", "worktree", "remove", "--force", str(worktree)],
                capture_output=True,
                text=True,
                check=False,
                env={**os.environ, "HUSKY": "0"},
            )


def main(argv=None):
    parser = argparse.ArgumentParser(description="Post an agy code review on a PR.")
    parser.add_argument("pr", type=int)
    parser.add_argument("--pro", action="store_true")
    parser.add_argument("--model")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--keep-worktree", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument(
        "--at", help="review an earlier commit of this PR (forces --dry-run)"
    )
    args = parser.parse_args(argv)

    model = args.model or (PRO_MODEL if args.pro else FLASH_MODEL)

    try:
        return review(
            args.pr, model, args.dry_run, args.keep_worktree, args.verbose, args.at
        )
    except ReviewError as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as exc:
        print(f"FAILED: {' '.join(exc.cmd)} → {exc.stderr}", file=sys.stderr)
        return 1
    except FileNotFoundError as exc:
        # `agy`, `gh` or `jq` not on PATH. The documented first-run state is "install the
        # Antigravity CLI and configure its settings.json", so a missing binary is the
        # likeliest first experience — it should say so rather than print a traceback.
        print(
            f"FAILED: {exc.filename} is not installed or not on PATH. "
            "agy_review.py needs `agy`, `gh` and `jq`; see this script's docstring for "
            "the agy configuration it also expects.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
