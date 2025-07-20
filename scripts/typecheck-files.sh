#!/bin/bash

# TypeScript File-Specific Type Checking Script
# Usage: ./scripts/typecheck-files.sh [options] <file-patterns...>
# Options:
#   -l, --lines N    Show N lines of errors (default: 10, use 0 for all)
# Examples:
#   ./scripts/typecheck-files.sh src/app/api/**/*.ts
#   ./scripts/typecheck-files.sh --lines 20 src/**/*test*.ts
#   ./scripts/typecheck-files.sh -l 0 src/app/api/qr/[qrCodeId]/route.ts

set -e

# Default values
LINES=10

# Parse options
while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--lines)
            LINES="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options] <file-patterns...>"
            echo "Options:"
            echo "  -l, --lines N    Show N lines of errors (default: 10, use 0 for all)"
            echo "Examples:"
            echo "  $0 src/app/api/**/*.ts"
            echo "  $0 --lines 20 src/**/*test*.ts"
            echo "  $0 -l 0 src/app/api/qr/[qrCodeId]/route.ts"
            exit 0
            ;;
        *)
            break
            ;;
    esac
done

# Check if arguments provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 [options] <file-patterns...>"
    echo "Use --help for more information"
    exit 1
fi

# Prepare head command based on lines setting
if [ "$LINES" -eq 0 ]; then
    HEAD_CMD="cat"  # Show all lines
else
    HEAD_CMD="head -$LINES"
fi

# Run TypeScript type checking on specified files
if [ "$LINES" -eq 0 ]; then
    echo "🔍 Type checking files: $* (showing all lines)"
else
    echo "🔍 Type checking files: $* (showing $LINES lines)"
fi
OUTPUT=$(npx tsc --noEmit "$@" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Type checking passed for specified files"
else
    echo "$OUTPUT" | $HEAD_CMD
    echo "❌ Type checking failed for specified files"
    exit 1
fi