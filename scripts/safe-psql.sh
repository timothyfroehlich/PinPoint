#!/bin/bash

# Safe PostgreSQL wrapper script
# Ensures psql can only connect to localhost with safety guardrails

set -euo pipefail

# Safety configuration
ALLOWED_HOSTS=("localhost" "127.0.0.1" "::1")
ALLOWED_DATABASES=("postgres" "pinpoint_test" "pinpoint_dev" "test")
DEFAULT_HOST="localhost"
DEFAULT_PORT="54322"  # Supabase local port
DEFAULT_DATABASE="postgres"
DEFAULT_USERNAME="postgres"
DEFAULT_PASSWORD="postgres"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo "Usage: $0 [options]"
    echo "Safe PostgreSQL client that only connects to localhost"
    echo ""
    echo "Options:"
    echo "  -h, --host HOST      Database host (must be localhost/127.0.0.1)"
    echo "  -p, --port PORT      Database port (default: 54322)"
    echo "  -d, --database DB    Database name (must be in allowed list)"
    echo "  -U, --username USER  Database username"
    echo "  -c, --command CMD    Execute command and exit"
    echo "  -f, --file FILE      Execute commands from file"
    echo "  --help               Show this help"
    echo ""
    echo "Allowed databases: ${ALLOWED_DATABASES[*]}"
    echo "Allowed hosts: ${ALLOWED_HOSTS[*]}"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Connect to localhost:54322/postgres"
    echo "  $0 -d pinpoint_test                   # Connect to test database"
    echo "  $0 -c 'SELECT version();'             # Execute single command"
    echo "  $0 -f setup-test-data.sql             # Execute SQL file"
}

# Function to check if host is allowed
is_host_allowed() {
    local host="$1"
    for allowed_host in "${ALLOWED_HOSTS[@]}"; do
        if [[ "$host" == "$allowed_host" ]]; then
            return 0
        fi
    done
    return 1
}

# Function to check if database is allowed
is_database_allowed() {
    local db="$1"
    for allowed_db in "${ALLOWED_DATABASES[@]}"; do
        if [[ "$db" == "$allowed_db" ]]; then
            return 0
        fi
    done
    return 1
}

# Parse command line arguments
HOST="$DEFAULT_HOST"
PORT="$DEFAULT_PORT"
DATABASE="$DEFAULT_DATABASE"
USERNAME="$DEFAULT_USERNAME"
COMMAND=""
FILE=""
PSQL_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            HOST="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -d|--database)
            DATABASE="$2"
            shift 2
            ;;
        -U|--username)
            USERNAME="$2"
            shift 2
            ;;
        -c|--command)
            COMMAND="$2"
            shift 2
            ;;
        -f|--file)
            FILE="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            # Pass through other arguments to psql
            PSQL_ARGS+=("$1")
            shift
            ;;
    esac
done

# Safety checks
echo -e "${YELLOW}🔒 Safety Checks:${NC}"

# Check if host is allowed
if ! is_host_allowed "$HOST"; then
    echo -e "${RED}❌ ERROR: Host '$HOST' is not allowed${NC}"
    echo -e "${RED}   Allowed hosts: ${ALLOWED_HOSTS[*]}${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Host '$HOST' is allowed${NC}"

# Check if database is allowed
if ! is_database_allowed "$DATABASE"; then
    echo -e "${RED}❌ ERROR: Database '$DATABASE' is not allowed${NC}"
    echo -e "${RED}   Allowed databases: ${ALLOWED_DATABASES[*]}${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Database '$DATABASE' is allowed${NC}"

# Check if file exists (if specified)
if [[ -n "$FILE" && ! -f "$FILE" ]]; then
    echo -e "${RED}❌ ERROR: File '$FILE' does not exist${NC}"
    exit 1
fi

# Build psql command
PSQL_CMD="psql"
PSQL_CMD+=" --host=$HOST"
PSQL_CMD+=" --port=$PORT"
PSQL_CMD+=" --dbname=$DATABASE"

if [[ -n "$USERNAME" ]]; then
    PSQL_CMD+=" --username=$USERNAME"
fi

if [[ -n "$FILE" ]]; then
    PSQL_CMD+=" --file=$FILE"
elif [[ -z "$COMMAND" ]]; then
    # Interactive mode - no additional flags needed
    :
fi

# Add any additional arguments
for arg in "${PSQL_ARGS[@]}"; do
    PSQL_CMD+=" $arg"
done

# Show connection info
echo ""
echo -e "${YELLOW}🔗 Connection Info:${NC}"
echo -e "   Host: ${GREEN}$HOST${NC}"
echo -e "   Port: ${GREEN}$PORT${NC}"
echo -e "   Database: ${GREEN}$DATABASE${NC}"
if [[ -n "$USERNAME" ]]; then
    echo -e "   Username: ${GREEN}$USERNAME${NC}"
fi
if [[ -n "$COMMAND" ]]; then
    echo -e "   Command: ${GREEN}[Multi-line command via stdin]${NC}"
fi
if [[ -n "$FILE" ]]; then
    echo -e "   File: ${GREEN}$FILE${NC}"
fi

echo ""
echo -e "${YELLOW}🚀 Executing:${NC} $PSQL_CMD"
echo ""

# Set password environment variable
export PGPASSWORD="$DEFAULT_PASSWORD"

# Execute psql command
if [[ -n "$COMMAND" ]]; then
    # For commands, use stdin to avoid shell argument parsing issues
    echo "$COMMAND" | eval "$PSQL_CMD"
else
    # For files or interactive mode, use normal execution
    eval "$PSQL_CMD"
fi