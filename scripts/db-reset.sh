#!/bin/bash

# =============================================================================
# PinPoint Database Reset Script
# =============================================================================
# Unified script for resetting database in local development and preview environments
#
# Usage:
#   ./scripts/db-reset.sh local    # Reset local Supabase database
#   ./scripts/db-reset.sh preview  # Reset preview environment database
#
# Features:
# - Uses your existing .env.local; does not auto-pull from Vercel
# - Uses modular SQL seed files for maintainability
# - Supports both Supabase (local/preview) and PostgreSQL-only (CI) workflows
# - Auto-generates TypeScript types after schema changes
# - Identical RLS policies across all environments
# =============================================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Force non-interactive output (prevent psql/supabase from invoking less)
export PAGER=cat
export LESS=FRX
export SUPABASE_PAGER=cat 2>/dev/null || true
export SUPABASE_LOG_LEVEL=${SUPABASE_LOG_LEVEL:-info}

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Script configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# =============================================================================
# Logging Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}" >&2
}

log_step() {
    echo -e "\n${BLUE}🔄 Step: $1${NC}"
}

# =============================================================================
# Validation Functions
# =============================================================================

validate_environment() {
    local env="$1"

    if [[ "$env" != "local" && "$env" != "preview" ]]; then
        log_error "Invalid environment: $env"
        log_error "Usage: $0 <local|preview>"
        exit 1
    fi

    log_info "Environment validated: $env"
}

validate_dependencies() {
    local missing_deps=()

    # Check for required commands
    command -v supabase >/dev/null || missing_deps+=("supabase")
    command -v npm >/dev/null || missing_deps+=("npm")
    command -v psql >/dev/null || missing_deps+=("psql")

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_error "Please install missing tools and try again"
        exit 1
    fi

    log_success "All dependencies available"
}

# =============================================================================
# Environment Safety Checks
# =============================================================================

validate_local_env_safety() {
    local env="$1"
    local allow_non_local="$2" # "true" to allow running with non-local env

    log_step "Validating .env.local safety for $env"

    if [[ ! -f ".env.local" ]]; then
        if [[ "$allow_non_local" != "true" ]]; then
            log_error ".env.local not found. Create it (copy from .env.example) or pass --allow-non-local to proceed."
            exit 1
        else
            log_warning ".env.local not found; proceeding due to --allow-non-local"
            return 0
        fi
    fi

    # Detect obvious cloud DB/URL patterns (supabase.co) to prevent accidental prod/preview targeting
    if grep -E "SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL|POSTGRES_URL|POSTGRES_URL_NON_POOLING|DATABASE_URL|SUPABASE_DB_URL" .env.local | grep -E "supabase\\.co|aws-" >/dev/null 2>&1; then
        if [[ "$allow_non_local" != "true" ]]; then
            log_error "Detected non-local Supabase/DB settings in .env.local (contains supabase.co/aws)."
            log_error "Run with --allow-non-local to proceed anyway."
            exit 1
        else
            log_warning "Proceeding with non-local settings due to --allow-non-local"
        fi
    else
        log_success ".env.local appears local-safe (no supabase.co/aws endpoints detected)"
    fi
}

# =============================================================================
# Database Operations
# =============================================================================

execute_sql_seeds() {
    local env="$1"

    log_step "Executing modular SQL seed files"

    # Define seed files in execution order based on environment
    local seed_files=()

    # Base infrastructure (all environments)
    seed_files=(
        "base/01-rls-policies.sql"
        "base/02-permissions.sql"
    )

    if [[ "$env" == "local" || "$env" == "preview" ]]; then
        # Add development/test data for local and preview
        seed_files+=(
            "dev/01-infrastructure.sql"
            "dev/02-metadata.sql"
            "dev/03-users.sql"
            "dev/04-machines.sql"
            "dev/05-issues.sql"
        )
    fi

    # Add Supabase-specific seeds for local and preview
    if [[ "$env" != "ci" ]]; then
        seed_files+=("dev/99-supabase-auth.sql")
    fi

    log_info "Executing ${#seed_files[@]} seed files..."

    for seed_file in "${seed_files[@]}"; do
        local seed_path="$PROJECT_ROOT/supabase/seeds/$seed_file"

        if [[ -f "$seed_path" ]]; then
            log_info "Executing: $seed_file"
            "$PROJECT_ROOT/scripts/safe-psql.sh" -f "$seed_path"
        else
            log_warning "Seed file not found: $seed_file"
        fi
    done

    log_success "All seed files executed successfully"

        # Quick verification of critical tables (best-effort; ignore failures)
        log_step "Verifying critical seed data (non-fatal)"
        {
            "$PROJECT_ROOT/scripts/safe-psql.sh" -c "\
                SELECT 'organizations' AS table, COUNT(*) AS count FROM organizations UNION ALL\
                SELECT 'users', COUNT(*) FROM users UNION ALL\
                SELECT 'machines', COUNT(*) FROM machines UNION ALL\
                SELECT 'issues', COUNT(*) FROM issues;" || true
        } | sed 's/^/    /'
}

reset_supabase_database() {
    local env="$1"

    log_step "Resetting Supabase database ($env)"

    # Reset database without running seed.sql (we use modular approach)
    log_info "Performing clean database reset..."
    supabase db reset --no-seed

    # Push Drizzle schema to database
    log_info "Applying Drizzle schema..."
    if [[ "$env" == "preview" ]]; then
        npm run db:push:preview
    else
        npm run db:push:local
    fi

    # Execute our modular seed files (includes RLS policies)
    execute_sql_seeds "$env"

    # Create dev users via Supabase Admin API (only for dev environments)
    if [[ "$env" == "local" || "$env" == "preview" ]]; then
        log_info "Creating dev users via Supabase Admin API..."
        if command -v tsx >/dev/null 2>&1; then
            if tsx scripts/create-dev-users.ts; then
                log_success "Dev users created successfully"
            else
                log_warning "Dev user creation failed, but continuing..."
            fi
        else
            log_warning "tsx not found, skipping dev user creation"
        fi
    fi

    # Sync schema definitions back to Drizzle
    log_info "Syncing schema definitions..."
    if [[ "$env" == "preview" ]]; then
        npx drizzle-kit pull --config=drizzle.config.prod.ts
    else
        npx drizzle-kit pull --config=drizzle.config.dev.ts
    fi

    log_success "Database reset completed for $env environment"
}

generate_typescript_types() {
    local env="$1"

    log_step "Generating TypeScript types from database schema"

    if [[ "$env" == "local" || "$env" == "preview" ]]; then
        log_info "Generating types from local database..."
        supabase gen types typescript --local > src/lib/types/database.ts
    else
        log_info "Generating types from preview database..."
        # For preview, we need the DATABASE_URL from environment
        if [[ -z "${DATABASE_URL:-}" ]]; then
            log_warning "DATABASE_URL not set, skipping type generation"
            return
        fi
        supabase gen types typescript --db-url "$DATABASE_URL" > src/lib/types/database.ts
    fi

    log_success "TypeScript types generated successfully"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo -e "${GREEN}"
    echo "======================================================================"
    echo "🗄️  PinPoint Database Reset"
    echo "======================================================================"
    echo -e "${NC}"

    # Validate arguments
    if [[ $# -lt 1 || $# -gt 2 ]]; then
        log_error "Usage: $0 <local|preview> [--allow-non-local]"
        log_error "  local   - Reset local Supabase database"
        log_error "  preview - Reset preview environment database (uses dev seeds)"
        log_error "  --allow-non-local  Proceed even if .env.local looks non-local (DANGEROUS)"
        exit 1
    fi

    local environment="$1"
    local allow_non_local="false"
    if [[ "${2:-}" == "--allow-non-local" ]]; then
        allow_non_local="true"
    fi

    # Change to project root
    cd "$PROJECT_ROOT"

    # Validation
    validate_environment "$environment"
    validate_dependencies
    validate_local_env_safety "$environment" "$allow_non_local"

    # Execution steps
    reset_supabase_database "$environment"
    generate_typescript_types "$environment"

    echo -e "\n${GREEN}"
    echo "======================================================================"
    echo "✅ Database reset completed successfully!"
    echo "======================================================================"
    echo -e "${NC}"

    log_info "Next steps:"
    if [[ "$environment" == "local" ]]; then
        log_info "• Run 'npm run dev' to start development server"
        log_info "• Check 'npm run db:studio' to browse database"
    else
        log_info "• Deploy changes: 'vercel --prod'"
        log_info "• Check 'npm run db:studio:preview' to browse database"
    fi

    log_info "• Run tests: 'npm run test:all'"
    log_info "• Validate RLS: 'npm run test:rls'"
}

# Error handling
trap 'log_error "Script failed at line $LINENO"' ERR

# Execute main function
main "$@"
