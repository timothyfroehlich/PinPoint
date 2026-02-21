#!/bin/bash
set -e

# Configuration
BACKUP_DIR="$HOME/.pinpoint/db-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pinpoint_prod_$TIMESTAMP.sql"
PROD_REF="udhesuizjsgxfeotqybn"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting manual backup of PinPoint production database...${NC}"

# Verify we're linked to the correct production project
echo -e "${BLUE}ℹ️  Checking current Supabase project link...${NC}"
CURRENT_REF=$(cat supabase/.temp/project-ref 2>/dev/null || echo "")

if [ -z "$CURRENT_REF" ]; then
    echo -e "${RED}❌ No Supabase project linked. Run 'supabase link' first.${NC}"
    exit 1
fi

if [ "$CURRENT_REF" != "$PROD_REF" ]; then
    echo -e "${RED}❌ Currently linked to project: $CURRENT_REF${NC}"
    echo -e "${RED}   Expected production project: $PROD_REF${NC}"
    echo -e "${YELLOW}⚠️  Refusing to backup wrong environment.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Confirmed linked to production project: $PROD_REF${NC}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Run supabase db dump
# We use --data-only because we want to seed a local DB that already has the schema applied via Drizzle
# We restrict to --schema public to avoid conflicts with local auth/internal tables
echo -e "${BLUE}📥 Dumping production data (public schema, data-only)...${NC}"

if supabase db dump --data-only --schema public > "$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Backup successful!${NC}"
    echo -e "${GREEN}📄 Location: $BACKUP_FILE${NC}"

    # Show file size
    DU_OUT=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${BLUE}📊 Size: $DU_OUT${NC}"
else
    echo -e "\033[0;31m❌ Backup failed!${NC}"
    # Remove empty or partial file
    [ -f "$BACKUP_FILE" ] && rm "$BACKUP_FILE"
    exit 1
fi
