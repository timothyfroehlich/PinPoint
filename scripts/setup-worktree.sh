#!/bin/bash
set -e

# Check for overwrite flag
OVERWRITE=false
if [[ "$1" == "--overwrite" ]]; then
    OVERWRITE=true
fi

echo "🔧 Worktree Setup - Using standard Supabase ports (54321-54324)"

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
echo "📥 Pulling environment variables from Vercel..."
vercel env pull .env

# Update environment variables for standard local development
echo "⚙️  Updating environment variables for local development..."
cat >> .env << EOF

# Local development configuration (standard Supabase ports)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
SUPABASE_API_URL=http://localhost:54321
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@localhost:54322/postgres
EOF

# Create symlink for .env.local (remove existing first)
rm -f .env.local
ln -sf .env .env.local

echo "✅ Environment configured for shared local Supabase instance"

# Install and setup
npm install

# Initialize Supabase if needed (using standard config)
echo "🚀 Checking Supabase initialization..."
if command -v supabase &> /dev/null; then
    if [ ! -f "supabase/config.toml" ]; then
        npx supabase init --create-project false
        echo "✅ Supabase initialized for worktree."
    else
        echo "ℹ️  Supabase already initialized (using standard config.toml)."
    fi
else
    echo "⚠️  Warning: Supabase CLI not found. Install with 'npm install -g supabase' if needed."
fi

# Set up database schema (using shared local database)
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

# Health check function
check_service_health() {
    echo "🔍 Performing service health checks..."
    
    # Check if Supabase is running on standard ports
    if curl -f -s "http://localhost:54321/health" > /dev/null 2>&1; then
        echo "✅ Supabase API (port 54321): Healthy"
    else
        echo "⚠️  Supabase API (port 54321): Not responding (run 'supabase start' if needed)"
    fi
    
    # Check database connectivity
    if command -v pg_isready &> /dev/null; then
        if pg_isready -p 54322 -h localhost > /dev/null 2>&1; then
            echo "✅ PostgreSQL (port 54322): Healthy" 
        else
            echo "⚠️  PostgreSQL (port 54322): Not responding"
        fi
    else
        echo "ℹ️  PostgreSQL check skipped (pg_isready not available)"
    fi
}

# Run health checks
check_service_health

echo ""
echo "🎉 Worktree setup complete!"
echo "📍 Using standard ports: API(54321) DB(54322) Studio(54323) Email(54324)"
echo "🚨 Database coordination: All worktrees share the same local Supabase instance"
echo "💡 Run './scripts/worktree-status.sh' to check environment health anytime"