#!/bin/bash
set -e

# Check for overwrite flag
OVERWRITE=false
if [[ "$1" == "--overwrite" ]]; then
    OVERWRITE=true
fi

# Safety check: warn if running from main repository
if [ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ]; then
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

# Copy Vercel project configuration from main worktree
MAIN_WORKTREE=$(git worktree list --porcelain | awk '/^worktree/ {print $2; exit}')
if [[ -d "$MAIN_WORKTREE/.vercel" ]]; then
    echo "Copying Vercel project configuration..."
    cp -r "$MAIN_WORKTREE/.vercel" .
else
    echo "No .vercel directory found in main worktree. Linking to Vercel project..."
    vercel link --yes --project pin-point --scope advacar

    # Now copy the newly created .vercel config to main worktree for future use
    if [[ -d ".vercel" && "$MAIN_WORKTREE" != "$(pwd)" ]]; then
        echo "Copying Vercel config back to main worktree for future worktrees..."
        cp -r .vercel "$MAIN_WORKTREE/"
    fi
fi

# Pull environment variables from Vercel
echo "Pulling environment variables from Vercel..."
vercel env pull .env

# Create symlink for .env.local (remove existing first)
rm -f .env.local
ln -sf .env .env.local

# Install and setup
npm install

# Set up database schema (using shared online database)
echo "Setting up database schema..."
if npm run db:push 2>/dev/null; then
    echo "Database schema synced successfully."
    
    # Generate Prisma client types
    echo "Generating Prisma client types..."
    if npx prisma generate 2>/dev/null; then
        echo "Prisma client types generated successfully."
    else
        echo "Warning: Could not generate Prisma client types."
        echo "Run 'npx prisma generate' manually if needed."
    fi
else
    echo "Warning: Could not sync database schema."
    echo "Check your database connection and run 'npm run db:push' manually."
fi

echo "Worktree setup complete!"
