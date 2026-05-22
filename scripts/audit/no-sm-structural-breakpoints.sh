#!/usr/bin/env bash
set -euo pipefail
# Detect viewport-breakpoint `sm:` used for structural layout decisions in
# React/TSX source files.  Per CORE-RESP-003, `sm:` is restricted to
# padding/spacing only; structural choices (column count, flex direction,
# block/hidden, alignment) must use container queries (@sm:, @md:, …).
#
# Structural utilities flagged when used after bare `sm:` (not `@sm:`):
#   grid-cols-*   flex-row   flex-col   flex-row-reverse   flex-col-reverse
#   block   hidden   inline*   items-*
#
# Opt-out options:
#   Line-level: add `// sm-structural-allow: <reason>` on the same line,
#               the line directly above, or the line directly below.
#   File-level: add `// sm-structural-allow-file: <reason>` anywhere in the
#               file (typically near the top) to exempt the entire file.
#
# Note: `@sm:` (container-query prefix) is explicitly excluded — it's the
# correct replacement pattern. The negative lookbehind `(?<!@)` ensures we
# only flag bare viewport `sm:`, not container-query `@sm:`.

if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) is required by $(basename "$0")" >&2
  echo "Install with: brew install ripgrep   (or: apt-get install ripgrep)" >&2
  exit 2
fi

# Use -P (PCRE) for the negative lookbehind (?<!@) to exclude @sm:
PATTERN='(?<!@)sm:(grid-cols-[0-9a-z]+|flex-(?:row|col)(?:-reverse)?|block|hidden|inline[-a-z]*|items-[a-z]+)'

# rg exit codes: 0=matches, 1=no matches, 2+=real error (e.g. missing PCRE2).
# Treat exit 1 as success (clean tree) but propagate any other failure.
set +e
raw=$(rg -n -P -B1 -A1 "$PATTERN" src \
  --glob '*.tsx' \
  --glob '*.ts' \
  --glob '!**/*.test.*' \
  --glob '!src/test/**')
rg_exit=$?
set -e
if [[ $rg_exit -ne 0 && $rg_exit -ne 1 ]]; then
  echo "ERROR: ripgrep failed unexpectedly (exit $rg_exit) when scanning for sm: structural breakpoints" >&2
  exit 2
fi

# Build a temp file listing paths that have a file-level allow comment.
allowed_files_tmp=$(mktemp)
trap 'rm -f "$allowed_files_tmp"' EXIT
set +e
rg -l 'sm-structural-allow-file:' src \
  --glob '*.tsx' \
  --glob '*.ts' \
  > "$allowed_files_tmp" 2>/dev/null
rg_exit=$?
set -e
if [[ $rg_exit -ne 0 && $rg_exit -ne 1 ]]; then
  echo "ERROR: ripgrep failed unexpectedly (exit $rg_exit) when listing allow-file paths" >&2
  exit 2
fi

matches=$(echo "$raw" | awk -v allowed_file="$allowed_files_tmp" '
  BEGIN {
    while ((getline line < allowed_file) > 0) {
      if (line != "") allowed_files[line] = 1
    }
    close(allowed_file)
  }
  function parse(line,    file, lineno, sep_char, content) {
    if (match(line, /:[0-9]+:/)) {
      sep_char = ":"
    } else if (match(line, /-[0-9]+-/)) {
      sep_char = "-"
    } else {
      return ""
    }
    file    = substr(line, 1, RSTART - 1)
    lineno  = substr(line, RSTART + 1, RLENGTH - 2)
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
    if (content ~ /sm-structural-allow:/) {
      allow[file, lineno] = 1
    }
    if (sep == ":") {
      mfile[NR] = file
      mline[NR] = lineno
      mraw[NR] = $0
    }
  }
  END {
    for (i in mfile) {
      f = mfile[i]; l = mline[i]
      # Skip if file-level allow exists for this file.
      if (f in allowed_files) continue
      if ((f, l) in allow) continue
      if ((f, l - 1) in allow) continue
      if ((f, l + 1) in allow) continue
      print mraw[i]
    }
  }
' | sort -u)

if [[ -n "$matches" ]]; then
  echo "ERROR: viewport sm: used for structural layout (CORE-RESP-003):" >&2
  echo "$matches" >&2
  echo "" >&2
  echo "Use container queries instead: @container on the parent, then @sm:/@md:/@lg:" >&2
  echo "  Bad:  <div className=\"flex flex-col sm:flex-row\">" >&2
  echo "  Good: <div className=\"@container\"><div className=\"flex flex-col @lg:flex-row\">" >&2
  echo "" >&2
  echo "For spacing/padding sm: is allowed. For intentional exceptions add:" >&2
  echo "  Line-level: // sm-structural-allow: <reason>" >&2
  echo "  File-level: // sm-structural-allow-file: <reason>  (exempts entire file)" >&2
  exit 1
fi
