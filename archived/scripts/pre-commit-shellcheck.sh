#!/bin/bash

# Pre-commit hook for shellcheck
# Detects shell scripts by extension and shebang, runs only on existing staged files

set -e

# Get staged files with .sh extension
staged_sh_files=$(git diff --cached --name-only --diff-filter=ACM | grep '\.sh$' || true)

# Get staged files with shell shebang (but not .sh extension)
staged_shell_files=""
if staged_files=$(git diff --cached --name-only --diff-filter=ACM); then
    for file in $staged_files; do
        if [[ -f "$file" ]] && head -1 "$file" 2>/dev/null | grep -q '^#!/.*sh'; then
            staged_shell_files="$staged_shell_files $file"
        fi
    done
fi

# Combine and deduplicate
all_shell_files=$(echo -e "$staged_sh_files\n$staged_shell_files" | tr ' ' '\n' | sort -u | grep -v '^$' || true)

if [[ -z "$all_shell_files" ]]; then
    echo "🐚 No shell scripts changed, skipping ShellCheck"
    exit 0
fi

# Filter to only existing files (handles deletions)
existing_files=()
while IFS= read -r file; do
    if [[ -f "$file" ]]; then
        existing_files+=("$file")
    fi
done <<< "$all_shell_files"

if [[ ${#existing_files[@]} -eq 0 ]]; then
    echo "🐚 No existing shell scripts to check"
    exit 0
fi

echo "🐚 Shell scripts detected (${#existing_files[@]} files), running ShellCheck..."

# Run shellcheck on all files (uses .shellcheckrc configuration)
shellcheck "${existing_files[@]}"