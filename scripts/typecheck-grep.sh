#!/bin/bash

# TypeScript File-Specific Type Checking with Grep Filtering
# Usage: ./scripts/typecheck-grep.sh [options] <grep-pattern> [file-patterns...]
# Options:
#   -l, --lines N    Show N lines (default: 5, use 0 for all)
# Examples:
#   ./scripts/typecheck-grep.sh "route\.ts" 
#   ./scripts/typecheck-grep.sh --lines 10 "test\.ts" src/**/*test*.ts
#   ./scripts/typecheck-grep.sh -l 0 "multi-tenant" src/server/**/*.ts

set -e

# Default values
LINES=5

# Parse options
while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--lines)
            LINES="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options] <grep-pattern> [file-patterns...]"
            echo "Options:"
            echo "  -l, --lines N    Show N lines (default: 5, use 0 for all)"
            echo "Examples:"
            echo "  $0 \"route\\.ts\"                        # Check all files, filter errors for route.ts"
            echo "  $0 --lines 10 \"test\\.ts\" src/**/*test*.ts    # Check test files, filter test.ts errors (10 lines)"
            echo "  $0 -l 0 \"multi-tenant\" src/server/**/* # Check server files, filter multi-tenant errors (all lines)"
            exit 0
            ;;
        *)
            break
            ;;
    esac
done

# Check if at least grep pattern provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 [options] <grep-pattern> [file-patterns...]"
    echo "Use --help for more information"
    exit 1
fi

GREP_PATTERN="$1"
shift

# Prepare head command based on lines setting
if [ "$LINES" -eq 0 ]; then
    HEAD_CMD="cat"  # Show all lines
else
    HEAD_CMD="head -$LINES"
fi

# If file patterns provided, use them; otherwise check all files
if [ $# -eq 0 ]; then
    if [ "$LINES" -eq 0 ]; then
        echo "🔍 Type checking all files, filtering for: $GREP_PATTERN (showing all lines)"
    else
        echo "🔍 Type checking all files, filtering for: $GREP_PATTERN (showing $LINES lines)"
    fi
    npx tsc --noEmit 2>&1 | grep -E "$GREP_PATTERN" | $HEAD_CMD || echo "✅ No errors found matching pattern: $GREP_PATTERN"
else
    echo "🔍 Type checking files: $*"
    if [ "$LINES" -eq 0 ]; then
        echo "📋 Filtering for: $GREP_PATTERN (showing all lines)"
    else
        echo "📋 Filtering for: $GREP_PATTERN (showing $LINES lines)"
    fi
    npx tsc --noEmit "$@" 2>&1 | grep -E "$GREP_PATTERN" | $HEAD_CMD || echo "✅ No errors found matching pattern: $GREP_PATTERN"
fi