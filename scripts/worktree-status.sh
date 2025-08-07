#!/bin/bash

# Worktree Status Script
# Provides comprehensive status of the current worktree development environment

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Standard Supabase ports (shared across all worktrees)
API_PORT=54321
DB_PORT=54322
STUDIO_PORT=54323
INBUCKET_PORT=54324

echo -e "${BLUE}🔍 PinPoint Worktree Status Report${NC}"
echo "==============================================="

# 1. Worktree and Git Status
echo -e "\n${PURPLE}🌿 Worktree Information${NC}"
CURRENT_BRANCH=$(git branch --show-current)
CURRENT_DIR=$(basename "$(pwd)")
echo -e "📂 Directory: ${CYAN}$CURRENT_DIR${NC}"
echo -e "🌿 Branch: ${CYAN}$CURRENT_BRANCH${NC}"

# Check if branch exists on remote and sync status
if git ls-remote --exit-code --heads origin "$CURRENT_BRANCH" > /dev/null 2>&1; then
    # Branch exists on remote, check sync status
    git fetch origin "$CURRENT_BRANCH" 2>/dev/null
    AHEAD=$(git rev-list --count HEAD..origin/"$CURRENT_BRANCH" 2>/dev/null || echo "0")
    BEHIND=$(git rev-list --count origin/"$CURRENT_BRANCH"..HEAD 2>/dev/null || echo "0")
    
    if [[ "$AHEAD" -gt 0 && "$BEHIND" -gt 0 ]]; then
        echo -e "📊 Sync Status: ${YELLOW}$BEHIND commits ahead, $AHEAD commits behind${NC}"
    elif [[ "$BEHIND" -gt 0 ]]; then
        echo -e "📊 Sync Status: ${GREEN}$BEHIND commits ahead${NC}"
    elif [[ "$AHEAD" -gt 0 ]]; then
        echo -e "📊 Sync Status: ${YELLOW}$AHEAD commits behind${NC}"
    else
        echo -e "📊 Sync Status: ${GREEN}Up to date${NC}"
    fi
else
    echo -e "📊 Sync Status: ${YELLOW}Local branch (not on remote)${NC}"
fi

# Outstanding changes
MODIFIED_FILES=$(git status --porcelain | wc -l)
if [[ "$MODIFIED_FILES" -gt 0 ]]; then
    echo -e "⚠️  Outstanding Changes: ${YELLOW}$MODIFIED_FILES files${NC}"
    echo "   Modified files:"
    git status --porcelain | head -5 | sed 's/^/   /'
    if [[ "$MODIFIED_FILES" -gt 5 ]]; then
        echo "   ... and $((MODIFIED_FILES - 5)) more"
    fi
else
    echo -e "✅ Outstanding Changes: ${GREEN}Clean working directory${NC}"
fi

# 2. Service Health Status
echo -e "\n${PURPLE}🚀 Service Health (Shared Instance)${NC}"
SERVICE_HEALTHY=true

# Check Supabase API
if curl -f -s "http://localhost:$API_PORT/health" > /dev/null 2>&1; then
    echo -e "✅ Supabase API (${CYAN}$API_PORT${NC}): ${GREEN}Healthy${NC}"
else
    echo -e "❌ Supabase API (${CYAN}$API_PORT${NC}): ${RED}Not responding${NC}"
    SERVICE_HEALTHY=false
fi

# Check PostgreSQL
if command -v pg_isready &> /dev/null; then
    if pg_isready -p "$DB_PORT" -h localhost > /dev/null 2>&1; then
        echo -e "✅ PostgreSQL (${CYAN}$DB_PORT${NC}): ${GREEN}Healthy${NC}"
    else
        echo -e "❌ PostgreSQL (${CYAN}$DB_PORT${NC}): ${RED}Not responding${NC}"
        SERVICE_HEALTHY=false
    fi
else
    echo -e "ℹ️  PostgreSQL (${CYAN}$DB_PORT${NC}): ${YELLOW}Cannot check (pg_isready not available)${NC}"
fi

# Check if Inbucket (email testing) is running
if curl -f -s "http://localhost:$INBUCKET_PORT" > /dev/null 2>&1; then
    echo -e "✅ Email Testing (${CYAN}$INBUCKET_PORT${NC}): ${GREEN}Healthy${NC}"
else
    echo -e "❌ Email Testing (${CYAN}$INBUCKET_PORT${NC}): ${RED}Not responding${NC}"
fi

# 3. Environment Validation
echo -e "\n${PURPLE}⚙️  Environment Validation${NC}"

# Check if .env exists and has required variables
if [[ -f ".env" ]]; then
    echo -e "✅ Environment File: ${GREEN}Present${NC}"
    
    # Check for key environment variables
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env; then
        SUPABASE_URL=$(grep "NEXT_PUBLIC_SUPABASE_URL" .env | cut -d'=' -f2)
        echo -e "✅ Supabase URL: ${GREEN}Configured${NC} ($SUPABASE_URL)"
    else
        echo -e "❌ Supabase URL: ${RED}Missing${NC}"
    fi
    
    if grep -q "DATABASE_URL" .env; then
        echo -e "✅ Database URL: ${GREEN}Configured${NC}"
    else
        echo -e "❌ Database URL: ${RED}Missing${NC}"
    fi
else
    echo -e "❌ Environment File: ${RED}Missing .env file${NC}"
fi

# Check node_modules
if [[ -d "node_modules" ]]; then
    echo -e "✅ Dependencies: ${GREEN}Installed${NC}"
else
    echo -e "❌ Dependencies: ${RED}Missing (run 'npm install')${NC}"
fi

# 4. Integration Tests
echo -e "\n${PURPLE}🧪 Integration Tests${NC}"
INTEGRATION_TESTS_PASSED=true

echo "Running quick integration tests..."

# Test 1: TypeScript compilation
echo -n "   TypeScript compilation... "
if npm run typecheck:brief > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    INTEGRATION_TESTS_PASSED=false
fi

# Test 2: Database connectivity (if services are healthy)
if [[ "$SERVICE_HEALTHY" == true ]]; then
    echo -n "   Database connectivity... "
    if timeout 10s npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
        INTEGRATION_TESTS_PASSED=false
    fi
else
    echo -e "   Database connectivity... ${YELLOW}⏭️  Skipped (services not healthy)${NC}"
fi

# 5. Shared Infrastructure Status
echo -e "\n${PURPLE}🔗 Shared Infrastructure${NC}"
echo -e "🚨 ${YELLOW}Database Coordination:${NC} All worktrees share the same local Supabase instance"
echo -e "⚠️  ${YELLOW}Schema Changes:${NC} Database modifications affect ALL active worktrees"

# Check for other active worktrees
if command -v git &> /dev/null; then
    WORKTREE_COUNT=$(git worktree list | wc -l)
    if [[ $WORKTREE_COUNT -gt 1 ]]; then
        echo -e "👥 ${CYAN}Active Worktrees:${NC} $WORKTREE_COUNT worktrees detected"
        echo "   Use 'git worktree list' to see all worktrees"
    else
        echo -e "👤 ${GREEN}Single Worktree:${NC} Only this worktree is active"
    fi
fi

# 6. Summary
echo -e "\n${PURPLE}📋 Summary${NC}"
if [[ "$SERVICE_HEALTHY" == true && "$INTEGRATION_TESTS_PASSED" == true && "$MODIFIED_FILES" -eq 0 ]]; then
    echo -e "🎉 ${GREEN}Environment Status: Excellent${NC}"
    echo "   Ready for development work!"
elif [[ "$SERVICE_HEALTHY" == true && "$INTEGRATION_TESTS_PASSED" == true ]]; then
    echo -e "👍 ${GREEN}Environment Status: Good${NC}" 
    echo "   Ready for development (some uncommitted changes)"
elif [[ "$SERVICE_HEALTHY" == true ]]; then
    echo -e "⚠️  ${YELLOW}Environment Status: Needs Attention${NC}"
    echo "   Services healthy but integration tests failed"
else
    echo -e "🚨 ${RED}Environment Status: Issues Detected${NC}"
    echo "   Services not healthy - run 'supabase start' if needed"
fi

# Port information
echo -e "\n${PURPLE}🔌 Port Configuration (Shared)${NC}"
echo -e "API: ${CYAN}$API_PORT${NC} | DB: ${CYAN}$DB_PORT${NC} | Studio: ${CYAN}$STUDIO_PORT${NC} | Email: ${CYAN}$INBUCKET_PORT${NC}"

# Quick commands reference  
echo -e "\n${PURPLE}💡 Quick Commands${NC}"
echo "   Start services: supabase start"
echo "   View logs: supabase logs"
echo "   Reset DB: npm run db:reset"
echo "   Run tests: npm run test"
echo "   Cleanup: ./scripts/worktree-cleanup.sh"
echo "   List worktrees: git worktree list"

echo "==============================================="