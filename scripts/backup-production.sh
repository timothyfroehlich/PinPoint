#!/bin/bash

# Configuration
BACKUP_DIR="$HOME/.pinpoint/db-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pinpoint_prod_$TIMESTAMP.sql"
PROD_REF="udhesuizjsgxfeotqybn"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting manual backup of PinPoint production database...${NC}"

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
