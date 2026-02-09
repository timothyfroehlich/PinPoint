#!/bin/bash
set -e  # Exit immediately if any command fails

# Configuration
BACKUP_DIR="$HOME/.pinpoint/db-backups"
ENV_FILE=".env.local"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check for custom backup file argument
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${BLUE}🔍 No backup file specified. Looking for the latest one in $BACKUP_DIR...${NC}"

    # Use find for robust file resolution, handling spaces and special characters
    BACKUP_FILE=$(
        find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pinpoint_prod_*.sql' -printf '%T@ %p\n' 2>/dev/null \
            | sort -nr \
            | head -n 1 \
            | cut -d' ' -f2-
    )

    if [ -z "$BACKUP_FILE" ]; then
        echo -e "${RED}❌ No backup files found in $BACKUP_DIR${NC}"
        exit 1
    fi
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will reset your local database and overwrite it with data from:${NC}"
echo -e "${BLUE}$BACKUP_FILE${NC}"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Aborted.${NC}"
    exit 1
fi

# Load and parse database URL from .env.local
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ $ENV_FILE not found. Cannot determine local database URL.${NC}"
    exit 1
fi

# Extract POSTGRES_URL line and strip key + optional surrounding quotes
POSTGRES_URL_LINE=$(grep -m1 "^POSTGRES_URL=" "$ENV_FILE" || echo "")
POSTGRES_URL=${POSTGRES_URL_LINE#POSTGRES_URL=}
# Remove surrounding double quotes if present
POSTGRES_URL=${POSTGRES_URL#\"}
POSTGRES_URL=${POSTGRES_URL%\"}

if [ -z "$POSTGRES_URL" ]; then
    echo -e "${RED}❌ POSTGRES_URL not found in $ENV_FILE${NC}"
    exit 1
fi

# Safety check: Ensure we're connecting to localhost
if [[ ! "$POSTGRES_URL" =~ (localhost|127\.0\.0\.1) ]]; then
    echo -e "${RED}❌ POSTGRES_URL does not point to localhost or 127.0.0.1${NC}"
    echo -e "${RED}   Refusing to reset non-local database: $POSTGRES_URL${NC}"
    echo -e "${YELLOW}⚠️  This script should ONLY be used with local development databases.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Verified POSTGRES_URL points to local database${NC}"

echo -e "${BLUE}🧹 Resetting local database schema...${NC}"
# Use the project's existing reset logic (minus seeding)
pnpm run db:_drop_tables
pnpm run db:migrate

echo -e "${BLUE}🌱 Seeding local database from production dump...${NC}"
# Use psql to apply the dump. We use --quiet and --set ON_ERROR_STOP=1
if psql "$POSTGRES_URL" --quiet -f "$BACKUP_FILE" --set ON_ERROR_STOP=1; then
    echo -e "${GREEN}✅ Local database seeded successfully!${NC}"
else
    echo -e "${RED}❌ Seeding failed!${NC}"
    exit 1
fi
