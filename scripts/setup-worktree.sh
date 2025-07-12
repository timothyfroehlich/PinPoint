#!/bin/bash
set -e

# Check for overwrite flag
OVERWRITE=false
if [[ "$1" == "--overwrite" ]]; then
    OVERWRITE=true
fi

# Check if .env exists and exit unless overwrite
if [[ -f .env && "$OVERWRITE" == "false" ]]; then
    echo ".env already exists. Use --overwrite flag to replace it."
    exit 1
fi

# Find main worktree and copy .env
MAIN_WORKTREE=$(git worktree list --porcelain | awk '/^worktree/ {worktree=$2} /branch main/ {print worktree; exit}')
cp "$MAIN_WORKTREE/.env" .env

# Create symlink for .env.local (remove existing first)
rm -f .env.local
ln -sf .env .env.local

# Install and setup
npm install

# Try to push database schema (skip if database is not running)
if npm run db:push 2>/dev/null; then
    echo "Database schema synced successfully."
else
    echo "Warning: Could not sync database schema (database may not be running)."
    echo "Run 'npm run db:push' manually when database is available."
fi

echo "Worktree setup complete!"