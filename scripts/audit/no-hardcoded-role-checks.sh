#!/usr/bin/env bash
set -euo pipefail
# Find all hardcoded role comparisons outside the permissions module + tests.
# Opt out by adding `// permissions-audit-allow: <reason>` on the same line
# OR on the line immediately above OR the line immediately below (prettier may
# wrap inline comments off the role-check line when they exceed printWidth,
# landing the marker either directly above or directly below depending on
# which side of a brace the original inline comment sat).
#
# `rg -B1 -A1` emits a 1-line context window before AND after each match so
# the awk filter can decide whether the violation has a paired allow-comment.
if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) is required by $(basename "$0")" >&2
  echo "Install with: brew install ripgrep   (or: apt-get install ripgrep)" >&2
  exit 2
fi
raw=$(rg -n -B1 -A1 '\brole\s*(===|!==)\s*"(admin|technician|member|guest)"' src \
  --glob '!src/lib/permissions/**' \
  --glob '!**/*.test.*' \
  --glob '!src/test/**' \
  || true)
# Two-pass awk: pass 1 collects (file, line) of allow-markers and matches.
# Pass 2 prints a violation only when no allow-marker exists at line-1, line,
# or line+1 in the same file. rg -B1 -A1 may print overlapping context blocks
# separated by `--`; we handle that by parsing every line independently.
matches=$(echo "$raw" | awk '
  function parse(line,    sep_idx, file, lineno, sep_char) {
    # Match lines look like: PATH:LINENO:CONTENT
    # Context lines look like: PATH-LINENO-CONTENT (rg uses "-" as separator)
    # The path can contain "-" or ":" (rare), so we anchor on the LAST
    # occurrence of either ":NUMBER:" or "-NUMBER-" near the start.
    # Simpler heuristic: split on the FIRST ":NN:" or "-NN-" pattern.
    if (match(line, /:[0-9]+:/)) {
      sep_char = ":"
    } else if (match(line, /-[0-9]+-/)) {
      sep_char = "-"
    } else {
      return ""
    }
    # RSTART points at the separator; back up to extract path.
    file = substr(line, 1, RSTART - 1)
    lineno = substr(line, RSTART + 1, RLENGTH - 2)
    content = substr(line, RSTART + RLENGTH)
    return file SUBSEP lineno SUBSEP sep_char SUBSEP content
  }
  /^--$/ { next }
  /^[[:space:]]*$/ { next }
  {
    parsed = parse($0)
    if (parsed == "") next
    n = split(parsed, parts, SUBSEP)
    file = parts[1]; lineno = parts[2] + 0; sep = parts[3]; content = parts[4]
    # Record allow markers at this (file, lineno).
    if (content ~ /permissions-audit-allow:/) {
      allow[file, lineno] = 1
    }
    if (sep == ":") {
      # This is a real match line; remember it for second pass.
      mfile[NR] = file
      mline[NR] = lineno
      mraw[NR] = $0
    }
  }
  END {
    for (i in mfile) {
      f = mfile[i]; l = mline[i]
      if ((f, l) in allow) continue
      if ((f, l - 1) in allow) continue
      if ((f, l + 1) in allow) continue
      print mraw[i]
    }
  }
' | sort -u)
if [[ -n "$matches" ]]; then
  echo "ERROR: hardcoded role checks outside src/lib/permissions/:" >&2
  echo "$matches" >&2
  echo "" >&2
  echo "Use checkPermission() from ~/lib/permissions/helpers." >&2
  echo "For intentional business logic (not a permission gate)," >&2
  echo "add a comment on the same line, the line directly above," >&2
  echo "or the line directly below the role check:" >&2
  echo "  // permissions-audit-allow: sole-admin invariant" >&2
  echo "  if (profile.role === \"admin\") { ... }" >&2
  exit 1
fi
