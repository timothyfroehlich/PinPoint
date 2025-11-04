#!/bin/bash
# Check if schema files changed and run database validation if needed

# Skip in remote environments (requires Supabase/PostgreSQL)
if [ -n "${IS_REMOTE_ENVIRONMENT:-}" ]; then
  echo "ℹ️  Skipping database schema validation in remote environment - this check requires Supabase CLI and will run in CI instead"
  exit 0
fi

# Get list of staged files
files=$(git diff --cached --name-only)

# Check if any schema-related files are modified
if echo "$files" | grep -q '(schema|drizzle)'; then
  echo '📊 Schema files detected, running database validation...'
  npm run db:validate:minimal
else
  echo '📊 No schema files changed, skipping database validation'
fi