#!/bin/bash

# =============================================================================
# PinPoint Database Reset Script
# =============================================================================
# Unified script for resetting database in local development and preview environments
#
# Usage:
#   ./scripts/db-reset.sh local    # Reset local Supabase database
#   ./scripts/db-reset.sh preview  # Reset preview environment database (with safety checks)
#
# Features:
# - Automatic vercel env pull integration for preview environments
# - Comprehensive safety checks and confirmation prompts for preview
# - Uses modular SQL seed files for maintainability
# - Supports both Supabase (local/preview) and PostgreSQL-only (CI) workflows
# - Auto-generates TypeScript types after schema changes
# - Identical RLS policies across all environments
# =============================================================================

# Skip in remote environments (requires Supabase CLI and Docker)
if [ -n "${IS_REMOTE_ENVIRONMENT:-}" ]; then
  echo "ℹ️  Skipping database reset in remote environment - this operation requires Supabase CLI and will run in CI instead"
  exit 0
fi

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
    local env="$1"

    # Check for required commands
    command -v supabase >/dev/null || missing_deps+=("supabase")
    command -v npm >/dev/null || missing_deps+=("npm")
    command -v psql >/dev/null || missing_deps+=("psql")

    # For preview environments, verify Vercel CLI is available
    if [[ "$env" == "preview" ]]; then
        command -v vercel >/dev/null || missing_deps+=("vercel")
    fi

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        if [[ " ${missing_deps[*]} " =~ " vercel " ]]; then
            log_error "For preview environments, install Vercel CLI: npm i -g vercel"
        fi
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

    # If .env.local is missing, that's OK in CI because Supabase CLI exports env via GITHUB_ENV
    if [[ ! -f ".env.local" ]]; then
        log_warning ".env.local not found; assuming CI with Supabase CLI-provided env (API_URL, SERVICE_ROLE_KEY, etc.)"
        return 0
    fi

    # Detect obvious cloud DB/URL patterns (supabase.co) to prevent accidental prod/preview targeting
    if grep -E "SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL|POSTGRES_URL|POSTGRES_URL_NON_POOLING|DATABASE_URL|SUPABASE_DB_URL" .env.local | grep -E "supabase\\.co|aws-" >/dev/null 2>&1; then
        if [[ "$allow_non_local" != "true" ]]; then
            log_error ".env.local contains cloud endpoints (supabase.co/aws). To prevent accidental data loss, script will not run."
            log_error "If you intend to target a non-local database, run with --allow-non-local (DANGEROUS)."
            log_error "Otherwise, update .env.local to point to your local Supabase instance."
            exit 1
        else
            log_warning ".env.local appears to contain non-local settings (supabase.co/aws)"
            log_warning "Proceeding with non-local settings due to --allow-non-local"
        fi
    else
        log_success ".env.local appears local-safe (no supabase.co/aws endpoints detected)"
    fi
}

# =============================================================================
# Vercel Environment Integration
# =============================================================================

backup_current_env() {
    if [[ -f ".env.local" ]]; then
        log_info "Backing up current .env.local"
        cp .env.local ".env.local.reset-backup-$(date +%Y%m%d-%H%M%S)"
        log_success "Current environment backed up"
    fi
}

restore_env_on_cleanup() {
    local backup_file
    backup_file=$(ls -t .env.local.reset-backup-* 2>/dev/null | head -n1)
    if [[ -n "$backup_file" && -f "$backup_file" ]]; then
        log_info "Restoring original .env.local from $backup_file"
        mv "$backup_file" .env.local
        log_success "Original environment restored"
    fi
    # Clean up any temporary preview env file
    [[ -f ".env.preview.tmp" ]] && rm -f .env.preview.tmp
}

pull_preview_environment() {
    log_step "Pulling preview environment from Vercel"
    
    # Pull preview environment variables to temporary file
    log_info "Downloading preview environment variables..."
    vercel env pull .env.preview.tmp --environment=preview
    
    # Replace current .env.local with preview environment
    mv .env.preview.tmp .env.local

    # Load the preview env vars into this shell so child processes see them
    # Export all variables defined in .env.local (Vercel format: KEY=VALUE per line)
    # shellcheck disable=SC1091
    set -a
    source .env.local
    set +a

    log_success "Preview environment activated"
}

confirm_preview_reset() {
    local database_url
    database_url=$(grep "^DATABASE_URL=" .env.local 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
    
    if [[ -z "$database_url" ]]; then
        log_error "DATABASE_URL not found in preview environment"
        exit 1
    fi
    
    # Extract host for display
    local host=""
    if [[ "$database_url" =~ postgresql://[^:]+:[^@]+@([^:]+) ]]; then
        host="${BASH_REMATCH[1]}"
    fi
    
    echo -e "\n${RED}⚠️  PREVIEW DATABASE RESET WARNING ⚠️${NC}"
    echo -e "${YELLOW}You are about to COMPLETELY RESET the preview database:${NC}"
    echo -e "   Host: ${RED}$host${NC}"
    echo -e "   Database: ${RED}$(basename "$database_url")${NC}"
    echo -e "\n${YELLOW}This will:${NC}"
    echo -e "• ${RED}DROP ALL EXISTING DATA${NC}"
    echo -e "• Apply fresh schema from local codebase"
    echo -e "• Load development seed data"
    echo -e "• Create development users"
    echo -e "\n${YELLOW}This action CANNOT be undone!${NC}"
    
    echo ""
    read -p "Type 'RESET PREVIEW' to confirm (case-sensitive): " confirmation
    
    if [[ "$confirmation" != "RESET PREVIEW" ]]; then
        log_error "Reset cancelled by user"
        exit 1
    fi
    
    log_success "Preview reset confirmed"
}

# =============================================================================
# Cloud Database Support Functions
# =============================================================================

parse_database_url() {
    local url="$1"
    # Trim surrounding quotes/whitespace/newlines
    url="${url%\n}"
    url="${url%\r}"
    url="${url#\"}"
    url="${url%\"}"
    url="${url#\'}"
    url="${url%\'}"
    
    if [[ -z "$url" ]]; then
        log_error "DATABASE_URL is required for preview environment"
        return 1
    fi

    # Parse PostgreSQL URL: postgresql://user:password@host:port/database?options
    if [[ ! "$url" =~ ^postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+)(\?(.*))?$ ]]; then
        log_error "Invalid DATABASE_URL format. Expected: postgresql://user:password@host:port/database"
        return 1
    fi

    DB_USER="${BASH_REMATCH[1]}"
    DB_PASSWORD="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
    DB_OPTIONS="${BASH_REMATCH[7]:-}"

    # Security validation - only allow trusted cloud providers
    if [[ ! "$DB_HOST" =~ \.(supabase\.co|pooler\.supabase\.com|amazonaws\.com|rds\.amazonaws\.com)$ ]]; then
        log_error "Untrusted database host: $DB_HOST"
        log_error "Only Supabase and AWS RDS hosts are allowed for preview environments"
        return 1
    fi

    log_success "Parsed DATABASE_URL: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
    return 0
}

execute_cloud_sql() {
    local sql_file="$1"
    local command="$2"

    if [[ -z "$DB_HOST" ]]; then
        log_error "Database connection parameters not set. Run parse_database_url first."
        return 1
    fi

    # Build psql command for cloud database
    local psql_cmd="psql"
    psql_cmd+=" --host=$DB_HOST"
    psql_cmd+=" --port=$DB_PORT"
    psql_cmd+=" --username=$DB_USER"
    psql_cmd+=" --dbname=$DB_NAME"
    psql_cmd+=" --no-password"  # Use PGPASSWORD environment variable
    psql_cmd+=" --set ON_ERROR_STOP=1"  # Stop on first error
    psql_cmd+=" --set AUTOCOMMIT=off"   # Use transactions
    
    # Enforce SSL for cloud databases via libpq env var
    export PGSSLMODE=require

    # Disable pager for script execution
    psql_cmd+=" --pset pager=off"
    psql_cmd+=" --quiet"

    # Set password environment variable
    export PGPASSWORD="$DB_PASSWORD"

    log_info "Connecting to cloud database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"

    if [[ -n "$sql_file" ]]; then
        log_info "Executing SQL file: $sql_file"
        $psql_cmd --file="$sql_file"
    elif [[ -n "$command" ]]; then
        log_info "Executing SQL command"
        echo "$command" | $psql_cmd
    else
        log_error "Either sql_file or command must be provided"
        return 1
    fi

    # Clear sensitive env vars
    unset PGPASSWORD
    unset PGSSLMODE

    return $?
}

# =============================================================================
# Database Operations
# =============================================================================

execute_sql_seeds() {
    local env="$1"

    log_step "Executing modular SQL seed files"

    # For preview environments, parse DATABASE_URL first
    if [[ "$env" == "preview" ]]; then
        if [[ -z "${DATABASE_URL:-}" ]]; then
            log_error "DATABASE_URL is required for preview environment"
            return 1
        fi
        
        log_info "Parsing DATABASE_URL for cloud database connection..."
        if ! parse_database_url "$DATABASE_URL"; then
            log_error "Failed to parse DATABASE_URL"
            return 1
        fi
    fi

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
            
            # Route to appropriate execution method based on environment
            if [[ "$env" == "preview" ]]; then
                # Use direct cloud database connection for preview
                execute_cloud_sql "$seed_path" ""
            else
                # Local environment: execute via psql directly
                PGPASSWORD="${PGPASSWORD:-postgres}" psql \
                  --host=localhost \
                  --port=54322 \
                  --username=postgres \
                  --dbname=postgres \
                  -v ON_ERROR_STOP=1 \
                  -f "$seed_path"
            fi
        else
            log_warning "Seed file not found: $seed_file"
        fi
    done

    log_success "All seed files executed successfully"

    # Quick verification of critical tables (best-effort; ignore failures)
    log_step "Verifying critical seed data (non-fatal)"
    {
        local verification_query="\
            SELECT 'organizations' AS table, COUNT(*) AS count FROM organizations UNION ALL\
            SELECT 'users', COUNT(*) FROM users UNION ALL\
            SELECT 'machines', COUNT(*) FROM machines UNION ALL\
            SELECT 'issues', COUNT(*) FROM issues;"
        
        if [[ "$env" == "preview" ]]; then
            # Use cloud database connection for verification
            execute_cloud_sql "" "$verification_query" || true
        else
            # Local verification via direct psql
            PGPASSWORD="${PGPASSWORD:-postgres}" psql \
              --host=localhost \
              --port=54322 \
              --username=postgres \
              --dbname=postgres \
              -v ON_ERROR_STOP=1 \
              -c "$verification_query" || true
        fi
    } | sed 's/^/    /'
}

reset_supabase_database() {
    local env="$1"

    log_step "Resetting Supabase database ($env)"

    # For local environments, reset the local Supabase instance
    if [[ "$env" == "local" ]]; then
        log_info "Performing clean database reset (local Supabase)..."
        supabase db reset --no-seed
    else
        log_info "Skipping local database reset for $env environment (cloud database)"
        log_warning "Note: Cloud database will be reset by schema push and seed execution"
    fi

    # Helper: wait for database readiness
    wait_for_db() {
        local tries=0
        local max_tries=60
        local sleep_secs=2

        log_info "Waiting for database to become ready..."
        while (( tries < max_tries )); do
            if [[ "$env" == "preview" ]]; then
                # Cloud DB readiness check
                if [[ -n "${DATABASE_URL:-}" ]]; then
                    if parse_database_url "$DATABASE_URL" >/dev/null 2>&1; then
                        if execute_cloud_sql "" "SELECT 1;" >/dev/null 2>&1; then
                            log_success "Database is ready"
                            return 0
                        fi
                    fi
                fi
            else
                # Local DB readiness check via direct psql
                if PGPASSWORD="${PGPASSWORD:-postgres}" psql \
                  --host=localhost --port=54322 --username=postgres --dbname=postgres \
                  -v ON_ERROR_STOP=1 -c "SELECT 1;" >/dev/null 2>&1; then
                    log_success "Database is ready"
                    return 0
                fi
            fi
            ((tries++))
            sleep "$sleep_secs"
        done
        log_error "Database did not become ready in time"
        return 1
    }

    # Push Drizzle schema to database (this will reset cloud databases)
    log_info "Applying Drizzle schema..."
    if [[ "$env" == "preview" ]]; then
        # Use --force flag to skip interactive confirmation for cloud databases
        wait_for_db
        npm run db:push:preview -- --force
    else
        wait_for_db
        npm run db:push:local
    fi

    # Execute our modular seed files (includes RLS policies)
    execute_sql_seeds "$env"

    # Create dev users via Supabase Admin API (only for dev environments)
    if [[ "$env" == "local" ]]; then
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
    elif [[ "$env" == "preview" ]]; then
        log_info "Preview environment: Dev users should be created via GitHub Actions"
        log_warning "For security, the SUPABASE_SECRET_KEY is only available in GitHub Actions"
        log_info "Run 'npm run preview:seed' to trigger secure seeding via GitHub Actions"
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

    if [[ "$env" == "local" ]]; then
        log_info "Generating types from local database..."
        supabase gen types typescript --local > src/lib/types/database.ts
    elif [[ "$env" == "preview" ]]; then
        log_info "Generating types from preview database..."
        if [[ -z "${DATABASE_URL:-}" ]]; then
            log_warning "DATABASE_URL not set, skipping type generation"
            return
        fi
        supabase gen types typescript --db-url "$DATABASE_URL" > src/lib/types/database.ts
    else
        log_warning "Unknown environment '$env' for type generation; skipping"
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
    if [[ $# -lt 1 ]]; then
        log_error "Usage: $0 <local|preview> [--allow-non-local] [--only-seed]"
        log_error "  local   - Reset local Supabase database"
        log_error "  preview - Reset preview environment database (with safety checks)"
        log_error "  --allow-non-local  Proceed even if .env.local looks non-local (DANGEROUS)"
        log_error "  --only-seed       Only run SQL seeds and dev user creation (no reset/push) [local]"
        exit 1
    fi

    local environment="$1"; shift || true
    local allow_non_local="false"
    local only_seed="false"
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --allow-non-local) allow_non_local="true"; shift ;;
            --only-seed) only_seed="true"; shift ;;
            *) log_error "Unknown option: $1"; exit 1 ;;
        esac
    done

    # Change to project root
    cd "$PROJECT_ROOT"

    # Set up cleanup on exit for preview environments
    if [[ "$environment" == "preview" ]]; then
        trap 'restore_env_on_cleanup' EXIT
    fi

    # Validation
    validate_environment "$environment"
    validate_dependencies "$environment"

    # Handle preview environment setup
    if [[ "$environment" == "preview" ]]; then
        backup_current_env
        pull_preview_environment
        confirm_preview_reset
        # Prefer pooler host on port 5432 (session/non-pooling) to avoid IPv6-only direct host
        if [[ -n "${DATABASE_URL:-}" ]]; then
            if parse_database_url "$DATABASE_URL"; then
                export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:5432/$DB_NAME"
                log_warning "Overriding DATABASE_URL to use $DB_HOST:5432 for schema and seed operations"
            fi
        fi
        # Skip local env safety check for preview since we just pulled cloud env
    else
        validate_local_env_safety "$environment" "$allow_non_local"
    fi

    # If only running seeds (no reset/push)
    if [[ "$only_seed" == "true" ]]; then
        if [[ "$environment" != "local" ]]; then
            log_error "--only-seed is currently supported for local environment only"
            exit 1
        fi

        log_step "Seed-only mode: applying SQL seeds and creating dev users (local)"
        execute_sql_seeds "$environment"

        # Create dev users via Supabase Admin API (local only)
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

        generate_typescript_types "$environment"

        trap - ERR
        echo -e "\n${GREEN}"
        echo "======================================================================"
        echo "✅ Seed-only completed successfully!"
        echo "======================================================================"
        echo -e "${NC}"
        return 0
    fi

    # Full reset + seeds
    reset_supabase_database "$environment"
    generate_typescript_types "$environment"

    # Disable ERR trap after successful completion to avoid spurious messages
    trap - ERR

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
        log_info "• Run 'npm run preview:seed' to create development users securely"
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
