#!/bin/bash
# migrate-test-file.sh - Helper script to migrate a test file from warnings to errors
# Usage: ./scripts/migrate-test-file.sh path/to/test.file.ts

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <test-file-path>"
    echo "Example: $0 src/server/api/__tests__/trpc-auth.test.ts"
    exit 1
fi

FILE=$1

if [ ! -f "$FILE" ]; then
    echo "Error: File '$FILE' not found"
    exit 1
fi

echo "🔍 Analyzing $FILE for migration to strict mode..."
echo ""

# Create temporary tsconfig for strict checking this file
TEMP_TSCONFIG=$(mktemp)
cat > "$TEMP_TSCONFIG" << EOF
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["$FILE"]
}
EOF

# Run TypeScript check
echo "📋 TypeScript strict mode check:"
echo "================================"
npx tsc --noEmit --project "$TEMP_TSCONFIG" || true
echo ""

# Run ESLint with strict rules
echo "📋 ESLint strict rules check:"
echo "============================="
npx eslint "$FILE" \
  --rule '@typescript-eslint/no-explicit-any: error' \
  --rule '@typescript-eslint/no-unsafe-assignment: error' \
  --rule '@typescript-eslint/no-unsafe-argument: error' \
  --rule '@typescript-eslint/no-unsafe-call: error' \
  --rule '@typescript-eslint/no-unsafe-member-access: error' \
  --rule '@typescript-eslint/no-unsafe-return: error' \
  --rule '@typescript-eslint/unbound-method: error' || true

# Cleanup
rm "$TEMP_TSCONFIG"

echo ""
echo "📝 Next steps:"
echo "1. Fix all TypeScript and ESLint errors shown above"
echo "2. Remove '$FILE' from the test file overrides in eslint.config.js"
echo "3. Run 'npm run validate:agent' to verify all checks pass"
echo "4. Update .betterer.results by running 'npm run betterer:update'"