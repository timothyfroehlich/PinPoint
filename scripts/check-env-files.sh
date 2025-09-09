#!/bin/bash

# check-env-files.sh - Prevent staging of .env* files except allowed ones
#
# This script blocks accidental commits of environment files that may contain secrets.
# Only .env and .env.example are allowed to be committed.

set -euo pipefail

# Get list of staged .env* files
staged_env_files=$(git diff --cached --name-only | grep -E '^\.env' || true)

if [ -z "$staged_env_files" ]; then
    echo "✅ No .env* files staged"
    exit 0
fi

# Define allowed .env files (using array for exact matching)
allowed_files=(".env" ".env.example")
blocked_files=""

# Check each staged .env* file
for file in $staged_env_files; do
    is_allowed=false
    for allowed in "${allowed_files[@]}"; do
        if [ "$file" = "$allowed" ]; then
            is_allowed=true
            break
        fi
    done
    
    if [ "$is_allowed" = false ]; then
        blocked_files="$blocked_files $file"
    fi
done

if [ -n "$blocked_files" ]; then
    echo "🚨 BLOCKED: The following .env* files cannot be committed:"
    for file in $blocked_files; do
        echo "   ❌ $file"
    done
    echo ""
    echo "💡 Only .env and .env.example are allowed to be committed."
    echo "🔧 To unstage these files, run:"
    for file in $blocked_files; do
        echo "   git reset HEAD $file"
    done
    echo ""
    echo "📝 Environment files that should not be committed:"
    echo "   • .env.local, .env.local.*, .env.*.local (local overrides)"
    echo "   • .env.development, .env.production (environment-specific)"
    echo "   • .env.backup, .env.test (backups/test configs)"
    echo "   • Any other .env* variants"
    echo ""
    echo "🛡️  This protection prevents accidental secret leaks."
    exit 1
fi

echo "✅ All staged .env* files are allowed"
exit 0