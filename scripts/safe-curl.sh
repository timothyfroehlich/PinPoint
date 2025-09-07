#!/bin/bash

# Agent-focused curl wrapper script
# Restricts curl to localhost to reduce risk for automated agents.
# Human contributors should use plain `curl` directly as needed.

set -euo pipefail

# Safety configuration
ALLOWED_HOSTS=("localhost" "127.0.0.1" "::1" "0.0.0.0")
ALLOWED_PROTOCOLS=("http" "https")
ALLOWED_PORT_RANGE_MIN=1024
ALLOWED_PORT_RANGE_MAX=65535
DEFAULT_PROTOCOL="http"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo "Usage: $0 [URL] [curl-options...]"
    echo "Safe curl client that only connects to localhost"
    echo ""
    echo "Security Restrictions:"
    echo "  • Only localhost/127.0.0.1/::1 and *.localhost hosts allowed"
    echo "  • Only HTTP/HTTPS protocols allowed"
    echo "  • Port range: $ALLOWED_PORT_RANGE_MIN-$ALLOWED_PORT_RANGE_MAX"
    echo ""
    echo "Examples:"
    echo "  $0 http://localhost:3000                    # Basic GET request"
    echo "  $0 http://apc.localhost:3000/issues         # Subdomain request"
    echo "  $0 http://localhost:3000/api/health -I      # HEAD request"
    echo "  $0 http://localhost:3000/api/users -X POST  # POST request"
    echo "  $0 localhost:3000                           # Auto-add http://"
    echo "  $0 :3000                                    # Auto-add http://localhost"
    echo ""
    echo "Allowed hosts: ${ALLOWED_HOSTS[*]}"
    echo "Allowed protocols: ${ALLOWED_PROTOCOLS[*]}"
    echo ""
    echo "Common curl options that work:"
    echo "  -I, --head           # HEAD request"
    echo "  -X, --request        # HTTP method"
    echo "  -H, --header         # Add header"
    echo "  -d, --data           # POST data"
    echo "  -v, --verbose        # Verbose output"
    echo "  -s, --silent         # Silent mode"
    echo "  -f, --fail           # Fail on HTTP errors"
    echo "  -L, --location       # Follow redirects"
    echo "  -o, --output         # Write to file"
    echo "  --json               # JSON data"
}

# Function to normalize URL
normalize_url() {
    local url="$1"
    
    # Handle shorthand formats
    if [[ "$url" =~ ^:[0-9]+$ ]]; then
        # :3000 -> http://localhost:3000
        url="http://localhost${url}"
    elif [[ "$url" =~ ^[a-zA-Z0-9.-]+:[0-9]+$ ]] && [[ ! "$url" =~ ^https?:// ]]; then
        # localhost:3000 -> http://localhost:3000
        url="http://${url}"
    elif [[ ! "$url" =~ ^https?:// ]]; then
        # Assume http if no protocol
        url="http://${url}"
    fi
    
    echo "$url"
}

# Function to extract host from URL
extract_host() {
    local url="$1"
    # Remove protocol
    local no_protocol="${url#*://}"
    # Remove path and query string
    local host_port="${no_protocol%%/*}"
    local host_port="${host_port%%\?*}"
    # Remove port if present
    local host="${host_port%:*}"
    echo "$host"
}

# Function to extract port from URL
extract_port() {
    local url="$1"
    # Remove protocol
    local no_protocol="${url#*://}"
    # Remove path and query string
    local host_port="${no_protocol%%/*}"
    local host_port="${host_port%%\?*}"
    
    if [[ "$host_port" =~ :[0-9]+$ ]]; then
        # Extract port number
        echo "${host_port##*:}"
    else
        # Default ports
        if [[ "$url" =~ ^https:// ]]; then
            echo "443"
        else
            echo "80"
        fi
    fi
}

# Function to extract protocol from URL
extract_protocol() {
    local url="$1"
    if [[ "$url" =~ ^https?:// ]]; then
        echo "${url%%://*}"
    else
        echo "$DEFAULT_PROTOCOL"
    fi
}

# Function to check if host is allowed
is_host_allowed() {
    local host="$1"
    
    # Check exact matches first
    for allowed_host in "${ALLOWED_HOSTS[@]}"; do
        if [[ "$host" == "$allowed_host" ]]; then
            return 0
        fi
    done
    
    # Check for localhost subdomains (*.localhost)
    if [[ "$host" =~ \.localhost$ ]]; then
        return 0
    fi
    
    return 1
}

# Function to check if protocol is allowed
is_protocol_allowed() {
    local protocol="$1"
    for allowed_protocol in "${ALLOWED_PROTOCOLS[@]}"; do
        if [[ "$protocol" == "$allowed_protocol" ]]; then
            return 0
        fi
    done
    return 1
}

# Function to check if port is in allowed range
is_port_allowed() {
    local port="$1"
    if [[ "$port" =~ ^[0-9]+$ ]] && [[ "$port" -ge "$ALLOWED_PORT_RANGE_MIN" ]] && [[ "$port" -le "$ALLOWED_PORT_RANGE_MAX" ]]; then
        return 0
    fi
    return 1
}

# Check if at least one argument is provided
if [[ $# -eq 0 ]]; then
    echo -e "${RED}❌ ERROR: No URL provided${NC}"
    echo ""
    show_usage
    exit 1
fi

# Check for help flag
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    show_usage
    exit 0
fi

# Get URL (first argument)
RAW_URL="$1"
shift

# Normalize URL
URL=$(normalize_url "$RAW_URL")

# Extract components
HOST=$(extract_host "$URL")
PORT=$(extract_port "$URL")
PROTOCOL=$(extract_protocol "$URL")

# Safety checks
echo -e "${YELLOW}🔒 Safety Checks:${NC}"

# Check protocol
if ! is_protocol_allowed "$PROTOCOL"; then
    echo -e "${RED}❌ ERROR: Protocol '$PROTOCOL' is not allowed${NC}"
    echo -e "${RED}   Allowed protocols: ${ALLOWED_PROTOCOLS[*]}${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Protocol '$PROTOCOL' is allowed${NC}"

# Check host
if ! is_host_allowed "$HOST"; then
    echo -e "${RED}❌ ERROR: Host '$HOST' is not allowed${NC}"
    echo -e "${RED}   Allowed hosts: ${ALLOWED_HOSTS[*]}${NC}"
    echo -e "${RED}   This tool only allows localhost connections for security${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Host '$HOST' is allowed${NC}"

# Check port range
if ! is_port_allowed "$PORT"; then
    echo -e "${RED}❌ ERROR: Port '$PORT' is outside allowed range${NC}"
    echo -e "${RED}   Allowed range: $ALLOWED_PORT_RANGE_MIN-$ALLOWED_PORT_RANGE_MAX${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Port '$PORT' is in allowed range${NC}"

# Show request info
echo ""
echo -e "${YELLOW}🌐 Request Info:${NC}"
echo -e "   Original: ${BLUE}$RAW_URL${NC}"
echo -e "   Normalized: ${BLUE}$URL${NC}"
echo -e "   Protocol: ${GREEN}$PROTOCOL${NC}"
echo -e "   Host: ${GREEN}$HOST${NC}"
echo -e "   Port: ${GREEN}$PORT${NC}"

# Show curl command that will be executed
CURL_ARGS=("$URL" "$@")
echo ""
echo -e "${YELLOW}🚀 Executing:${NC} curl ${CURL_ARGS[*]}"
echo ""

# Execute curl with all remaining arguments
exec curl "${CURL_ARGS[@]}"
