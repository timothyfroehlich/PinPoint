#!/bin/bash
set -e

# Check for overwrite flag
OVERWRITE=false
if [[ "$1" == "--overwrite" ]]; then
    OVERWRITE=true
fi

# Safety check: warn if running from main repository
CURRENT_PATH=$(pwd)
if ! npx tsx scripts/port-utils.ts check "$CURRENT_PATH" | grep -q "Is worktree: true"; then
    echo "⚠️  Warning: This script is designed for Git worktrees."
    echo "   You appear to be in the main repository."
    echo "   Running this may overwrite your .env.local and affect your main development setup."
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Check if .env exists and exit unless overwrite
if [[ -f .env && "$OVERWRITE" == "false" ]]; then
    echo ".env already exists. Use --overwrite flag to replace it."
    exit 1
fi

# Find main worktree and copy .env
# Look for the first worktree (which should be the main repo)
MAIN_WORKTREE=$(git worktree list --porcelain | awk '/^worktree/ {print $2; exit}')
cp "$MAIN_WORKTREE/.env" .env

# Configure unique ports for this worktree
CURRENT_PATH=$(pwd)
echo "Configuring ports for worktree: $CURRENT_PATH"

# Use port utility to generate unique ports if this is a worktree
if npx tsx scripts/port-utils.ts check "$CURRENT_PATH" | grep -q "Is worktree: true"; then
    echo "Detected worktree environment - configuring unique ports..."
    
    # Generate and append port configuration to .env (but keep shared DATABASE_URL)
    echo "" >> .env
    echo "# Worktree-specific port configuration (auto-generated)" >> .env
    
    # Only add PORT and PRISMA_STUDIO_PORT, not DATABASE_URL (use shared database)
    PORT=$(npx tsx scripts/port-utils.ts port "$CURRENT_PATH")
    PRISMA_PORT=$((PORT + 1))
    
    echo "PORT=$PORT" >> .env
    echo "PRISMA_STUDIO_PORT=$PRISMA_PORT" >> .env
    
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

# Start database container for this worktree
echo "Starting database container..."
export SETUP_WORKTREE_RUNNING=1
if ./start-database.sh; then
    echo "Database container started successfully."
    
    # Wait for database to be ready with proper health check
    echo "Waiting for database to be ready..."
    for i in {1..30}; do
        sleep 1
        if npm run db:push 2>/dev/null; then
            echo "Database schema synced successfully."
            break
        fi
        if [ $i -eq 30 ]; then
            echo "Warning: Database took too long to be ready."
            echo "Run 'npm run db:push' manually when database is ready."
        fi
    done
else
    echo "Warning: Could not start database container."
    echo "Run './start-database.sh' and 'npm run db:push' manually."
fi

echo "Worktree setup complete!"