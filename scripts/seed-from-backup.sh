#!/bin/bash

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
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/pinpoint_prod_*.sql 2>/dev/null | head -n 1)

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

# Load database URL from .env.local
if [ -f "$ENV_FILE" ]; then
    # Simple grep/sed to extract DATABASE_URL
    DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2-)
else
    echo -e "${RED}❌ $ENV_FILE not found. Cannot determine local database URL.${NC}"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not found in $ENV_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}🧹 Resetting local database schema...${NC}"
# Use the project's existing reset logic (minus seeding)
pnpm run db:_drop_tables
pnpm run db:migrate

echo -e "${BLUE}🌱 Seeding local database from production dump...${NC}"
# Use psql to apply the dump. We use --quiet and --set ON_ERROR_STOP=1
if psql "$DATABASE_URL" -f "$BACKUP_FILE" --set ON_ERROR_STOP=1; then
    echo -e "${GREEN}✅ Local database seeded successfully!${NC}"
else
    echo -e "${RED}❌ Seeding failed!${NC}"
    exit 1
fi
