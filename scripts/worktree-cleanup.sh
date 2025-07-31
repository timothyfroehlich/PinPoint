#!/bin/bash

# Worktree Cleanup Script
# Safely tears down the current worktree environment and its services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse command line options
FORCE=false
KEEP_WORKTREE=false
QUIET=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f)
            FORCE=true
            shift
            ;;
        --keep-worktree|-k)
            KEEP_WORKTREE=true
            shift
            ;;
        --quiet|-q)
            QUIET=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force, -f         Force cleanup without confirmation"
            echo "  --keep-worktree, -k Keep worktree directory (only cleanup services)"
            echo "  --quiet, -q         Minimal output"
            echo "  --help, -h          Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

if [[ "$QUIET" != true ]]; then
    echo -e "${BLUE}🧹 PinPoint Worktree Cleanup${NC}"
    echo "=============================="
fi

# Load port configuration if available
if [[ -f ".worktree-ports" ]]; then
    source .worktree-ports
    if [[ "$QUIET" != true ]]; then
        echo -e "📍 Detected ports: API($API_PORT) DB($DB_PORT) Studio($STUDIO_PORT) Email($INBUCKET_PORT)"
    fi
else
    if [[ "$QUIET" != true ]]; then
        echo -e "${YELLOW}⚠️  No port configuration found (.worktree-ports missing)${NC}"
        echo "Will attempt cleanup using process discovery..."
    fi
fi

# Safety check: ensure we're in a worktree
if [ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ]; then
    echo -e "${RED}❌ Error: This script should only be run from a git worktree${NC}"
    echo "You appear to be in the main repository. This could be dangerous."
    if [[ "$FORCE" != true ]]; then
        exit 1
    else
        echo -e "${YELLOW}⚠️  Continuing due to --force flag${NC}"
    fi
fi

# Confirmation unless --force
if [[ "$FORCE" != true && "$QUIET" != true ]]; then
    CURRENT_DIR=$(basename "$(pwd)")
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    
    echo -e "\n${YELLOW}⚠️  About to cleanup:${NC}"
    echo -e "   📂 Directory: $CURRENT_DIR"
    echo -e "   🌿 Branch: $CURRENT_BRANCH"
    
    if [[ "$KEEP_WORKTREE" == true ]]; then
        echo -e "   🔧 Action: Stop services only (keep worktree)"
    else
        echo -e "   🔧 Action: Full cleanup (remove worktree)"
    fi
    
    echo ""
    read -p "Continue with cleanup? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cleanup cancelled."
        exit 0
    fi
fi

cleanup_errors=()

# 1. Stop Supabase services
if [[ "$QUIET" != true ]]; then
    echo -e "\n${PURPLE}🛑 Stopping Supabase Services${NC}"
fi

if command -v supabase &> /dev/null; then
    if [[ "$QUIET" == true ]]; then
        supabase stop --no-backup > /dev/null 2>&1
        cleanup_result=$?
    else
        echo -n "   Stopping Supabase... "
        supabase stop --no-backup
        cleanup_result=$?
    fi
    
    if [[ $cleanup_result -eq 0 ]]; then
        if [[ "$QUIET" != true ]]; then
            echo -e "✅ Supabase services stopped"
        fi
    else
        if [[ "$QUIET" != true ]]; then
            echo -e "${YELLOW}⚠️  Supabase stop reported issues (may already be stopped)${NC}"
        fi
    fi
else
    if [[ "$QUIET" != true ]]; then
        echo -e "${YELLOW}⚠️  Supabase CLI not found, skipping service stop${NC}"
    fi
fi

# 2. Kill any remaining processes on our ports (if we know them)
if [[ -n "$API_PORT" ]]; then
    if [[ "$QUIET" != true ]]; then
        echo -e "\n${PURPLE}🔌 Cleaning Up Port Usage${NC}"
    fi
    
    for port in "$API_PORT" "$DB_PORT" "$STUDIO_PORT" "$INBUCKET_PORT"; do
        if [[ -n "$port" ]]; then
            # Find and kill processes using our ports
            PIDS=$(lsof -t -i:$port 2>/dev/null || true)
            if [[ -n "$PIDS" ]]; then
                if [[ "$QUIET" != true ]]; then
                    echo -n "   Freeing port $port... "
                fi
                echo $PIDS | xargs kill -TERM 2>/dev/null || true
                sleep 1
                # Force kill if still running
                REMAINING_PIDS=$(lsof -t -i:$port 2>/dev/null || true)
                if [[ -n "$REMAINING_PIDS" ]]; then
                    echo $REMAINING_PIDS | xargs kill -KILL 2>/dev/null || true
                fi
                if [[ "$QUIET" != true ]]; then
                    echo -e "${GREEN}✅${NC}"
                fi
            elif [[ "$QUIET" != true ]]; then
                echo -e "   Port $port: ${GREEN}already free${NC}"
            fi
        fi
    done
fi

# 3. Clean up temporary files and configuration
if [[ "$QUIET" != true ]]; then
    echo -e "\n${PURPLE}🗑️  Cleaning Temporary Files${NC}"
fi

# Remove generated files
files_to_remove=(".worktree-ports" "supabase/config.toml" ".env.local")
for file in "${files_to_remove[@]}"; do
    if [[ -f "$file" ]]; then
        rm -f "$file"
        if [[ "$QUIET" != true ]]; then
            echo -e "   Removed: $file"
        fi
    fi
done

# Clean up Supabase data directory if it exists
if [[ -d "supabase/.temp" ]]; then
    rm -rf "supabase/.temp"
    if [[ "$QUIET" != true ]]; then
        echo -e "   Removed: supabase/.temp"
    fi
fi

# 4. Clean up Docker containers and volumes (optional, careful!)
if command -v docker &> /dev/null; then
    if [[ "$QUIET" != true ]]; then
        echo -e "\n${PURPLE}🐳 Docker Cleanup${NC}"
    fi
    
    # Find and stop Supabase-related containers
    SUPABASE_CONTAINERS=$(docker ps -q --filter "name=supabase" 2>/dev/null || true)
    if [[ -n "$SUPABASE_CONTAINERS" ]]; then
        if [[ "$QUIET" != true ]]; then
            echo -n "   Stopping Supabase containers... "
        fi
        echo $SUPABASE_CONTAINERS | xargs docker stop > /dev/null 2>&1 || true
        if [[ "$QUIET" != true ]]; then
            echo -e "${GREEN}✅${NC}"
        fi
    elif [[ "$QUIET" != true ]]; then
        echo -e "   ${GREEN}No Supabase containers running${NC}"
    fi
    
    # Prune orphaned containers and networks (be careful!)
    if [[ "$FORCE" == true ]]; then
        if [[ "$QUIET" != true ]]; then
            echo -n "   Pruning orphaned resources... "
        fi
        docker system prune -f > /dev/null 2>&1 || true
        if [[ "$QUIET" != true ]]; then
            echo -e "${GREEN}✅${NC}"
        fi
    fi
else
    if [[ "$QUIET" != true ]]; then
        echo -e "${YELLOW}⚠️  Docker not available, skipping container cleanup${NC}"
    fi
fi

# 5. Worktree removal (if requested)
if [[ "$KEEP_WORKTREE" != true ]]; then
    if [[ "$QUIET" != true ]]; then
        echo -e "\n${PURPLE}🗂️  Worktree Removal${NC}"
    fi
    
    CURRENT_DIR=$(pwd)
    PARENT_DIR=$(dirname "$CURRENT_DIR")
    WORKTREE_NAME=$(basename "$CURRENT_DIR")
    
    # Move up one directory to safely remove the worktree
    cd "$PARENT_DIR"
    
    # Remove the worktree using git
    if git worktree remove "$WORKTREE_NAME" --force > /dev/null 2>&1; then
        if [[ "$QUIET" != true ]]; then
            echo -e "✅ Worktree '$WORKTREE_NAME' removed successfully"
        fi
    else
        # Fallback: manual directory removal
        if [[ "$QUIET" != true ]]; then
            echo -e "${YELLOW}⚠️  Git worktree remove failed, attempting manual cleanup...${NC}"
        fi
        if rm -rf "$CURRENT_DIR" 2>/dev/null; then
            if [[ "$QUIET" != true ]]; then
                echo -e "✅ Directory removed manually"
            fi
        else
            cleanup_errors+=("Failed to remove worktree directory: $CURRENT_DIR")
        fi
    fi
    
    # Clean up any remaining git references
    git worktree prune > /dev/null 2>&1 || true
fi

# 6. Summary
if [[ "$QUIET" != true ]]; then
    echo -e "\n${PURPLE}📋 Cleanup Summary${NC}"
    
    if [[ ${#cleanup_errors[@]} -eq 0 ]]; then
        echo -e "🎉 ${GREEN}Cleanup completed successfully!${NC}"
        if [[ "$KEEP_WORKTREE" == true ]]; then
            echo "   Services stopped, worktree preserved"
        else
            echo "   Worktree and all services cleaned up"
        fi
    else
        echo -e "⚠️  ${YELLOW}Cleanup completed with some issues:${NC}"
        for error in "${cleanup_errors[@]}"; do
            echo -e "   ${RED}•${NC} $error"
        done
    fi
    
    echo "=============================="
fi

# Exit with appropriate code
if [[ ${#cleanup_errors[@]} -eq 0 ]]; then
    exit 0
else
    exit 1
fi