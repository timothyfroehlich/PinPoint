#!/bin/bash
set -e

# ☢️  NUCLEAR DATABASE RESET ☢️
# This script DESTROYS and rebuilds a remote database (preview OR production)
#
# Usage: ./scripts/nuclear-db-reset.sh <environment> [--yes]
# Example: ./scripts/nuclear-db-reset.sh preview
# Example: ./scripts/nuclear-db-reset.sh production --yes
#
# Environments:
#   preview    - Uses .env.preview.local
#   production - Uses .env.production.local (REQUIRES DOUBLE CONFIRMATION)

# Color codes for dramatic effect
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
ENVIRONMENT=""
SKIP_CONFIRM=false

while [[ $# -gt 0 ]]; do
  case $1 in
    preview|production)
      ENVIRONMENT="$1"
      shift
      ;;
    --yes|-y)
      SKIP_CONFIRM=true
      shift
      ;;
    *)
      echo -e "${RED}Error: Unknown argument '$1'${NC}"
      echo "Usage: $0 <preview|production> [--yes]"
      exit 1
      ;;
  esac
done

if [ -z "$ENVIRONMENT" ]; then
  echo -e "${RED}Error: Environment required${NC}"
  echo "Usage: $0 <preview|production> [--yes]"
  exit 1
fi

# Set environment file based on environment
if [ "$ENVIRONMENT" = "preview" ]; then
  ENV_FILE=".env.preview.local"
elif [ "$ENVIRONMENT" = "production" ]; then
  ENV_FILE=".env.production.local"
  # NEVER allow --yes for production
  if [ "$SKIP_CONFIRM" = true ]; then
    echo -e "${RED}❌ ERROR: --yes flag is NOT allowed for production resets${NC}"
    echo "Production requires manual confirmation for safety."
    exit 1
  fi
else
  echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'${NC}"
  exit 1
fi

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error: Environment file '$ENV_FILE' not found${NC}"
  echo ""
  echo "To fetch production environment variables from Vercel:"
  echo -e "${BLUE}vercel env pull .env.production.local --environment=production${NC}"
  exit 1
fi

# Display dramatic header
echo ""
echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                                                           ║${NC}"
echo -e "${RED}║           ☢️  NUCLEAR DATABASE RESET ☢️                   ║${NC}"
echo -e "${RED}║                                                           ║${NC}"
echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Config File: ${ENV_FILE}${NC}"
echo ""

# Load environment variables
set -a
source "$ENV_FILE"
set +a

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL not found in $ENV_FILE${NC}"
  exit 1
fi

# Extract password from DATABASE_URL using Node.js for safety
DB_PASSWORD=$(node -e 'try { console.log(new URL(process.env.DATABASE_URL).password) } catch (e) { console.error(e); process.exit(1) }')

if [ -z "$DB_PASSWORD" ]; then
  echo -e "${RED}Error: Could not extract password from DATABASE_URL${NC}"
  exit 1
fi

# Construct Session Pool URL (IPv4-compatible)
DATABASE_URL="postgresql://postgres.gjmpvmelowpgsveupbcy:${DB_PASSWORD}@aws-0-us-east-2.pooler.supabase.com:5432/postgres"

# Update DIRECT_URL to match
export DATABASE_URL
export DIRECT_URL="$DATABASE_URL"

# Masked database URL for display
MASKED_URL=$(echo "$DATABASE_URL" | sed -E 's/(:[^:]+:)[^@]+(@)/\1***\2/')

# First confirmation (always required)
if [ "$SKIP_CONFIRM" = false ]; then
  echo -e "${RED}⚠️  WARNING: This will PERMANENTLY DESTROY all data!${NC}"
  echo ""
  echo "Database: $MASKED_URL"
  echo ""

  if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${RED}🚨 THIS IS PRODUCTION! 🚨${NC}"
    echo ""
    echo "Before proceeding, confirm:"
    echo "  1. You have a recent backup"
    echo "  2. You've notified stakeholders of downtime"
    echo "  3. You've tested this migration on preview"
    echo ""
  fi

  read -p "Type the environment name to confirm ($ENVIRONMENT): " confirm_env

  if [ "$confirm_env" != "$ENVIRONMENT" ]; then
    echo -e "${GREEN}Aborted. (You typed: '$confirm_env')${NC}"
    exit 0
  fi
fi

# Second confirmation for production (ALWAYS required, no bypass)
if [ "$ENVIRONMENT" = "production" ]; then
  echo ""
  echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}FINAL CONFIRMATION REQUIRED FOR PRODUCTION${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  read -p "Type 'DESTROY PRODUCTION DATABASE' to proceed: " final_confirm

  if [ "$final_confirm" != "DESTROY PRODUCTION DATABASE" ]; then
    echo -e "${GREEN}Aborted. (You typed: '$final_confirm')${NC}"
    exit 0
  fi

  echo ""
  echo -e "${YELLOW}Proceeding with production reset in 5 seconds...${NC}"
  echo -e "${YELLOW}Press Ctrl+C to abort!${NC}"
  sleep 5
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Starting database reset...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Drop and recreate schema
echo -e "${BLUE}1️⃣  Dropping and recreating schema...${NC}"
psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;" 2>&1 | grep -v "^NOTICE:" | grep -v "^DETAIL:" || true

# Verify schema is empty
echo "   Verifying schema is empty..."
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" | tr -d ' ')
if [ "$TABLE_COUNT" -ne 0 ]; then
  echo -e "   ${YELLOW}⚠️  Warning: Found $TABLE_COUNT tables after schema drop. Attempting to drop them individually...${NC}"
  psql "$DATABASE_URL" -c "
    DO \$\$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
      LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END \$\$;
  " 2>&1 | grep -v "^NOTICE:" | grep -v "^DETAIL:" || true
fi
echo -e "${GREEN}✅ Schema reset${NC}"

# Step 2: Apply migrations
echo ""
echo -e "${BLUE}2️⃣  Applying schema with drizzle-kit migrations...${NC}"
pnpm exec drizzle-kit migrate

# Verify tables were created
echo "   Verifying tables were created..."
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" | tr -d ' ')
echo "   Found $TABLE_COUNT tables in public schema"
if [ "$TABLE_COUNT" -eq 0 ]; then
  echo -e "${RED}   ❌ Error: No tables created by drizzle-kit migrate!${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Schema applied${NC}"

# Step 3: Run SQL seed
echo ""
echo -e "${BLUE}3️⃣  Running SQL seed...${NC}"
psql "$DATABASE_URL" -f supabase/seed.sql 2>&1 | grep -v "^NOTICE:" | grep -v "^DETAIL:" || true
echo -e "${GREEN}✅ SQL seed complete${NC}"

# Step 4: Seed users
echo ""
echo -e "${BLUE}4️⃣  Seeding users...${NC}"
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$SUPABASE_SECRET_KEY" ]; then
  echo -e "${YELLOW}⚠️  Skipping user seeding (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY not set in $ENV_FILE)${NC}"
else
  node supabase/seed-users.mjs
  echo -e "${GREEN}✅ Users seeded${NC}"
fi

# Success message
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Database reset complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
  echo -e "${YELLOW}⚠️  Remember to:${NC}"
  echo "  1. Verify the application is working"
  echo "  2. Check that all migrations applied correctly"
  echo "  3. Notify stakeholders that the system is back online"
  echo ""
fi
