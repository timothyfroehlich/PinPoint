#!/bin/bash
# migrate-test-directory.sh - Migrate all test files in a directory
# Usage: ./scripts/migrate-test-directory.sh src/server/api/__tests__/

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <directory-path>"
    echo "Example: $0 src/server/api/__tests__/"
    exit 1
fi

DIR=$1

if [ ! -d "$DIR" ]; then
    echo "Error: Directory '$DIR' not found"
    exit 1
fi

echo "🔍 Finding test files in $DIR..."
TEST_FILES=$(find "$DIR" -name "*.test.ts" -o -name "*.test.tsx" | sort)

if [ -z "$TEST_FILES" ]; then
    echo "No test files found in $DIR"
    exit 0
fi

echo "Found test files:"
echo "$TEST_FILES" | nl
echo ""

# Count total errors
TOTAL_TS_ERRORS=0
TOTAL_ESLINT_ERRORS=0

for FILE in $TEST_FILES; do
    echo "Checking $FILE..."
    TS_ERRORS=$(npx tsc --noEmit --strict "$FILE" 2>&1 | grep -c "error TS" || echo "0")
    ESLINT_ERRORS=$(npx eslint "$FILE" --rule '@typescript-eslint/no-explicit-any: error' 2>&1 | grep -c "error" || echo "0")
    
    TOTAL_TS_ERRORS=$((TOTAL_TS_ERRORS + TS_ERRORS))
    TOTAL_ESLINT_ERRORS=$((TOTAL_ESLINT_ERRORS + ESLINT_ERRORS))
    
    echo "  TypeScript errors: $TS_ERRORS"
    echo "  ESLint errors: $ESLINT_ERRORS"
done

echo ""
echo "📊 Summary for $DIR:"
echo "Total TypeScript errors: $TOTAL_TS_ERRORS"
echo "Total ESLint errors: $TOTAL_ESLINT_ERRORS"
echo ""
echo "Run './scripts/migrate-test-file.sh <file>' for detailed analysis of each file"