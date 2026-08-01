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

    # "Missing directory", "unlistable directory" and "directory with no dumps"
    # are three different problems. Report them separately — collapsing a failed
    # lookup into "no backups found" is the exact bug being fixed here.
    if [ ! -d "$BACKUP_DIR" ]; then
        echo -e "${RED}❌ Backup directory does not exist: $BACKUP_DIR${NC}"
        echo -e "${YELLOW}   Run 'pnpm run db:backup' to create one.${NC}"
        exit 1
    fi

    # An unreadable/unsearchable directory yields the same empty glob as an empty
    # one, so check before matching rather than misreporting the result after.
    if [ ! -r "$BACKUP_DIR" ] || [ ! -x "$BACKUP_DIR" ]; then
        echo -e "${RED}❌ Backup lookup failed: cannot list $BACKUP_DIR (permission denied).${NC}"
        echo -e "${YELLOW}   This is not the same as having no backups — fix the directory permissions.${NC}"
        exit 1
    fi

    # Backups are named pinpoint_prod_<YYYYmmdd_HHMMSS>.sql, so lexicographic
    # order IS chronological order — the newest is simply the greatest name.
    # A plain glob needs no stat() and no find(1) extension, so it behaves
    # identically under GNU and BSD userlands. (This used to be
    # `find -printf '%T@ %p\n' 2>/dev/null`; -printf is GNU findutils only, so
    # on macOS find errored, the redirect ate the message, and the script
    # claimed the directory was empty — PP-euhg.)
    shopt -s nullglob
    backup_candidates=("$BACKUP_DIR"/pinpoint_prod_*.sql)
    shopt -u nullglob

    if [ ${#backup_candidates[@]} -eq 0 ]; then
        echo -e "${RED}❌ No backup files found in $BACKUP_DIR${NC}"
        echo -e "${YELLOW}   Expected files named pinpoint_prod_<YYYYmmdd_HHMMSS>.sql.${NC}"
        echo -e "${YELLOW}   Run 'pnpm run db:backup' to create one.${NC}"
        exit 1
    fi

    # Pick the greatest name. An explicit loop (rather than ${arr[-1]}) keeps
    # this working on macOS's stock bash 3.2, which has no negative indexing.
    BACKUP_FILE=${backup_candidates[0]}
    for candidate in "${backup_candidates[@]}"; do
        if [[ $candidate > $BACKUP_FILE ]]; then
            BACKUP_FILE=$candidate
        fi
    done

    echo -e "${GREEN}✓ Found ${#backup_candidates[@]} backup(s); using the newest${NC}"
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
# Remove surrounding quotes if present (double or single)
POSTGRES_URL=${POSTGRES_URL#\"}
POSTGRES_URL=${POSTGRES_URL%\"}
POSTGRES_URL=${POSTGRES_URL#\'}
POSTGRES_URL=${POSTGRES_URL%\'}

if [ -z "$POSTGRES_URL" ]; then
    echo -e "${RED}❌ POSTGRES_URL not found in $ENV_FILE${NC}"
    exit 1
fi

# Safety check: parse the host out of POSTGRES_URL and require a local loopback.
# Substring matching (e.g. =~ localhost) would wrongly pass a remote host or a
# password that merely contains "localhost".
db_hostport=${POSTGRES_URL#*://} # strip scheme
db_hostport=${db_hostport##*@}   # strip userinfo@ (greedy: host follows the last @)
db_hostport=${db_hostport%%/*}   # strip /path
db_host=${db_hostport%%:*}       # strip :port
case "$db_host" in
    localhost | 127.0.0.1) ;;
    *)
        echo -e "${RED}❌ POSTGRES_URL host is not local: ${db_host}${NC}"
        echo -e "${RED}   Refusing to reset non-local database.${NC}"
        echo -e "${YELLOW}⚠️  This script should ONLY be used with local development databases.${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✓ Verified POSTGRES_URL points to a local database (${db_host})${NC}"

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

# Backfill historical machine-timeline events from the freshly loaded prod data.
# The prod dump carries machines/issues but no synthesized timeline_events for
# pre-V1 history, so without this the Timeline tab is empty locally (PP-7kil).
# Idempotent NOT-EXISTS backfill; matches what db:reset / db:fast-reset do.
echo -e "${BLUE}🕓 Backfilling machine timeline events...${NC}"
pnpm run db:_seed-timeline-backfill
