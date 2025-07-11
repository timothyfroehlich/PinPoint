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
MAIN_WORKTREE=$(git worktree list | head -1 | awk '{print $1}')
cp "$MAIN_WORKTREE/.env" .env

# Configure unique ports for this worktree
CURRENT_PATH=$(pwd)
echo "Configuring ports for worktree: $CURRENT_PATH"

# Use port utility to generate unique ports if this is a worktree
if npx tsx scripts/port-utils.ts check "$CURRENT_PATH" | grep -q "Is worktree: true"; then
    echo "Detected worktree environment - configuring unique ports..."
    
    # Generate and append port configuration to .env
    echo "" >> .env
    echo "# Worktree-specific port configuration (auto-generated)" >> .env
    npx tsx scripts/port-utils.ts env "$CURRENT_PATH" >> .env
    
    echo "Port configuration added to .env"
    npx tsx scripts/port-utils.ts check "$CURRENT_PATH"
else
    echo "Using default ports (not a worktree environment)"
fi

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