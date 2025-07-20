#!/bin/bash

# Script to update TypeScript migration statistics in TYPESCRIPT_MIGRATION.md
# Usage: ./scripts/update-typescript-stats.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📊 Gathering TypeScript migration statistics..."

# Get TypeScript error count
echo -n "Running typecheck... "
TS_OUTPUT=$(npm run typecheck 2>&1 || true)
TS_ERRORS=$(echo "$TS_OUTPUT" | grep -E "Found [0-9]+ error" | grep -oE "[0-9]+" | head -1 2>/dev/null || echo "0")
if [ -z "$TS_ERRORS" ] || [ "$TS_ERRORS" = "" ]; then
  # Count individual error lines if summary not found
  TS_ERRORS=$(echo "$TS_OUTPUT" | grep -cE "error TS[0-9]+:" 2>/dev/null || echo "0")
fi
# Ensure TS_ERRORS is a valid number
if ! [[ "$TS_ERRORS" =~ ^[0-9]+$ ]]; then
  TS_ERRORS=0
fi
echo -e "${GREEN}✓${NC} Found ${RED}$TS_ERRORS${NC} TypeScript errors"

# Get ESLint warning count
echo -n "Running lint check... "
LINT_OUTPUT=$(npm run lint 2>&1 || true)
# Extract warning count from ESLint output
TOTAL_WARNINGS=$(echo "$LINT_OUTPUT" | grep -E "[0-9]+ problems? \([0-9]+ errors?, [0-9]+ warnings?\)" | grep -oE "[0-9]+ warning" | grep -oE "[0-9]+" || echo "0")
# Count type-safety specific warnings
TYPE_WARNINGS=$(echo "$LINT_OUTPUT" | grep -cE "@typescript-eslint/(no-unsafe-|no-explicit-any|explicit-function-return-type)" || echo "0")
echo -e "${GREEN}✓${NC} Found ${YELLOW}$TOTAL_WARNINGS${NC} total warnings (${YELLOW}$TYPE_WARNINGS${NC} type-safety)"

# Count 'any' usage
echo -n "Counting 'any' usage... "
ANY_COUNT=$(grep -r --include="*.ts" --include="*.tsx" -E ":\s*any|as\s+any|<any>|any\[\]" src/ | grep -v "node_modules" | grep -v "eslint-disable.*no-explicit-any" | wc -l || echo "0")
echo -e "${GREEN}✓${NC} Found ${YELLOW}$ANY_COUNT${NC} instances of 'any'"

# Get current date and git commit
CURRENT_DATE=$(date +%Y-%m-%d)
CURRENT_COMMIT=$(git rev-parse --short HEAD)

# Update the markdown file
echo -e "\n📝 Updating TYPESCRIPT_MIGRATION.md..."

# Create backup
cp TYPESCRIPT_MIGRATION.md TYPESCRIPT_MIGRATION.md.bak

# Update the Current Status section
sed -i.tmp "s/\*\*Last Updated\*\*:.*/\*\*Last Updated\*\*: $CURRENT_DATE/" TYPESCRIPT_MIGRATION.md
sed -i.tmp "s/| TypeScript Errors |.*|.*|/| TypeScript Errors | $TS_ERRORS | 0 |/" TYPESCRIPT_MIGRATION.md
sed -i.tmp "s/| ESLint Warnings (Total) |.*|.*|/| ESLint Warnings (Total) | $TOTAL_WARNINGS | 0 |/" TYPESCRIPT_MIGRATION.md
sed -i.tmp "s/| Type-Safety Warnings |.*|.*|/| Type-Safety Warnings | $TYPE_WARNINGS | 0 |/" TYPESCRIPT_MIGRATION.md
sed -i.tmp "s/| 'any' Usage |.*|.*|/| 'any' Usage | $ANY_COUNT | 0 |/" TYPESCRIPT_MIGRATION.md

# Add new entry to history if counts changed
LAST_TS_ERRORS=$(grep -E "^\| [0-9]{4}-[0-9]{2}-[0-9]{2}" TYPESCRIPT_MIGRATION.md | tail -1 | awk -F'|' '{print $4}' | tr -d ' ' || echo "999")
if [ "$TS_ERRORS" != "$LAST_TS_ERRORS" ]; then
  echo "Adding new history entry..."
  # Find the history table and add new row (find the table header and insert after it)
  sed -i.tmp "/^| Date.*| Commit.*| TS Errors.*| ESLint Warnings.*| 'any' Count.*| Notes.*|$/{
n
a\\
| $CURRENT_DATE | $CURRENT_COMMIT | $TS_ERRORS | $TOTAL_WARNINGS ($TYPE_WARNINGS type) | $ANY_COUNT | Auto-updated |
}" TYPESCRIPT_MIGRATION.md
fi

# Clean up temp files
rm -f TYPESCRIPT_MIGRATION.md.tmp

echo -e "\n${GREEN}✅ Update complete!${NC}"
echo -e "\nSummary:"
echo -e "  TypeScript Errors: ${RED}$TS_ERRORS${NC}"
echo -e "  ESLint Warnings: ${YELLOW}$TOTAL_WARNINGS${NC} (${YELLOW}$TYPE_WARNINGS${NC} type-safety)"
echo -e "  'any' Usage: ${YELLOW}$ANY_COUNT${NC}"

# Show progress
if [ "$TS_ERRORS" -eq 0 ] && [ "$TOTAL_WARNINGS" -eq 0 ] && [ "$ANY_COUNT" -eq 0 ]; then
  echo -e "\n🎉 ${GREEN}Congratulations! Full TypeScript strict compliance achieved!${NC} 🎉"
elif [ "$TS_ERRORS" -lt 50 ]; then
  echo -e "\n📈 Great progress! Almost there..."
else
  echo -e "\n💪 Keep going! Every error fixed is progress!"
fi