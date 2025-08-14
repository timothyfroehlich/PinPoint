#!/bin/bash
# migration-review.sh - Main orchestration script for migration code review

# Don't exit on errors, let review complete
# set -e

ARGUMENTS="$1"

echo "🚀 Migration Code Review - August 2025 Best Practices"
echo ""

# Determine what to review based on arguments
if [[ "$ARGUMENTS" =~ ^[0-9]+$ ]]; then
  echo "🔍 PR Review Mode: #$ARGUMENTS"
  gh pr view "$ARGUMENTS"
  echo ""
  FILES=$(gh pr diff "$ARGUMENTS" --name-only)
elif [[ "$ARGUMENTS" == *.* ]]; then
  echo "📄 Single File Review: $ARGUMENTS"
  FILES="$ARGUMENTS"
  git log --oneline -3 -- "$ARGUMENTS"
  echo ""
else
  MODE="${ARGUMENTS:-full}"
  echo "🎯 ${MODE^} Review Mode - Branch Changes vs origin/main"
  git status --porcelain
  FILES=$(git diff --name-only origin/main..HEAD)
  if [[ -z "$FILES" ]]; then
    echo "ℹ️ No changes detected on branch vs origin/main"
    echo "📋 Checking recent commit instead..."
    FILES=$(git show --name-only --pretty=format: HEAD | grep -v '^$')
  fi
fi

if [[ -z "$FILES" ]]; then
  echo "❌ No files to review"
  exit 1
fi

echo "📋 Files to review:"
echo "$FILES"
echo ""

# File categorization
ROUTERS=""
SCHEMAS=""
COMPONENTS=""
ACTIONS=""
TESTS=""
INTEGRATION_TESTS=""
OTHERS=""

echo "📂 File Categorization:"
for file in $FILES; do
  case "$file" in
    src/server/api/routers/*.ts)
      echo "🗄️ ROUTER: $file"
      ROUTERS+="$file "
      ;;
    src/server/db/schema/*.ts)
      echo "📊 SCHEMA: $file"
      SCHEMAS+="$file "
      ;;
    src/app/**/*.tsx)
      echo "⚡ SERVER_COMPONENT: $file"
      COMPONENTS+="$file "
      ;;
    src/app/actions/*.ts)
      echo "🎬 SERVER_ACTION: $file"
      ACTIONS+="$file "
      ;;
    **/*.integration.test.ts)
      echo "🔗 INTEGRATION_TEST: $file"
      INTEGRATION_TESTS+="$file "
      ;;
    **/*.test.ts|**/*.test.tsx)
      echo "🧪 TEST: $file"
      TESTS+="$file "
      ;;
    *)
      echo "📄 OTHER: $file"
      OTHERS+="$file "
      ;;
  esac
done
echo ""

# Get script directory for calling other scripts
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run anti-pattern detection
if [[ -f "$SCRIPT_DIR/detect-anti-patterns.sh" ]]; then
  "$SCRIPT_DIR/detect-anti-patterns.sh" "$ROUTERS" "$SCHEMAS" "$COMPONENTS" "$ACTIONS" "$TESTS" "$INTEGRATION_TESTS" "$MODE"
else
  echo "⚠️ detect-anti-patterns.sh not found, skipping pattern detection"
fi

echo ""

# Run quality gates
if [[ -f "$SCRIPT_DIR/quality-gates.sh" ]]; then
  "$SCRIPT_DIR/quality-gates.sh" "$TESTS" "$INTEGRATION_TESTS"
else
  echo "⚠️ quality-gates.sh not found, skipping quality checks"
fi

echo ""

# Run standards assessment
if [[ -f "$SCRIPT_DIR/assess-standards.sh" ]]; then
  "$SCRIPT_DIR/assess-standards.sh" "$FILES"
else
  echo "⚠️ assess-standards.sh not found, skipping standards assessment"
fi

echo ""
echo "✅ Migration review complete!"