#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Worktree Status Report${NC}"
echo "========================================"

# Get list of all worktrees
WORKTREES=$(git worktree list --porcelain | awk '/^worktree/ {print $2}')

# Check if any worktrees exist
if [ -z "$WORKTREES" ]; then
    echo -e "${YELLOW}No worktrees found${NC}"
    exit 0
fi

# Function to check if a branch has a remote PR
check_pr_status() {
    local branch=$1
    local remote_exists=$(git ls-remote --heads origin "$branch" 2>/dev/null)
    if [ -n "$remote_exists" ]; then
        echo "Remote branch exists"
    else
        echo "No remote branch"
    fi
}

# Function to get last commit info
get_last_commit() {
    local worktree_path=$1
    cd "$worktree_path"
    local last_commit=$(git log -1 --pretty=format:"%h %s" 2>/dev/null)
    if [ -n "$last_commit" ]; then
        echo "$last_commit"
    else
        echo "No commits"
    fi
}

# Function to check if worktree is in PinPoint-worktrees directory
is_task_worktree() {
    local path=$1
    if [[ "$path" == *"PinPoint-worktrees"* ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# Function to get worktree status
get_worktree_status() {
    local worktree_path=$1
    cd "$worktree_path"
    
    # Check if there are uncommitted changes
    if ! git diff --quiet HEAD 2>/dev/null; then
        echo -e "${YELLOW}Uncommitted changes${NC}"
    elif ! git diff --quiet --cached 2>/dev/null; then
        echo -e "${YELLOW}Staged changes${NC}"
    else
        echo -e "${GREEN}Clean${NC}"
    fi
}

# Function to check if .claude/SUBAGENT_TASK.md exists
check_task_file() {
    local worktree_path=$1
    if [ -f "$worktree_path/.claude/SUBAGENT_TASK.md" ]; then
        echo -e "${GREEN}✓ Task file exists${NC}"
    else
        echo -e "${RED}✗ No task file${NC}"
    fi
}

# Iterate through each worktree
for worktree in $WORKTREES; do
    # Skip if worktree doesn't exist (corrupted worktree)
    if [ ! -d "$worktree" ]; then
        echo -e "${RED}⚠️  Corrupted worktree: $worktree${NC}"
        continue
    fi
    
    # Get worktree info
    cd "$worktree"
    branch=$(git branch --show-current 2>/dev/null || echo "detached")
    is_task=$(is_task_worktree "$worktree")
    
    echo ""
    echo -e "${BLUE}📁 Worktree:${NC} $worktree"
    echo -e "${BLUE}🌿 Branch:${NC} $branch"
    
    # Only show detailed info for task worktrees
    if [ "$is_task" = "true" ]; then
        echo -e "${BLUE}📋 Task File:${NC} $(check_task_file "$worktree")"
        echo -e "${BLUE}📊 Status:${NC} $(get_worktree_status "$worktree")"
        echo -e "${BLUE}🔄 Remote:${NC} $(check_pr_status "$branch")"
        echo -e "${BLUE}💾 Last Commit:${NC} $(get_last_commit "$worktree")"
        
        # Check if there's a dev server running
        if [ -f "$worktree/.env" ]; then
            # Try to extract port from .env
            port=$(grep "^PORT=" "$worktree/.env" 2>/dev/null | cut -d'=' -f2 || echo "3000")
            if lsof -i :$port >/dev/null 2>&1; then
                echo -e "${BLUE}🚀 Dev Server:${NC} ${GREEN}Running on port $port${NC}"
            else
                echo -e "${BLUE}🚀 Dev Server:${NC} ${RED}Not running${NC}"
            fi
        fi
    else
        echo -e "${BLUE}📝 Type:${NC} Main repository"
    fi
    
    echo "----------------------------------------"
done

echo ""
echo -e "${BLUE}💡 Cleanup Recommendations:${NC}"

# Check for worktrees that might be ready for cleanup
cd "$(git worktree list --porcelain | awk '/^worktree/ {print $2; exit}')" # Go back to main repo
for worktree in $WORKTREES; do
    if [ ! -d "$worktree" ]; then
        continue
    fi
    
    cd "$worktree"
    branch=$(git branch --show-current 2>/dev/null || echo "detached")
    is_task=$(is_task_worktree "$worktree")
    
    if [ "$is_task" = "true" ]; then
        # Check if branch exists remotely (might indicate merged PR)
        if ! git ls-remote --heads origin "$branch" >/dev/null 2>&1; then
            echo -e "  ${YELLOW}•${NC} $worktree - Branch '$branch' has no remote (possibly merged?)"
        fi
        
        # Check if worktree is clean and has no task file
        if ! [ -f "$worktree/.claude/SUBAGENT_TASK.md" ]; then
            echo -e "  ${YELLOW}•${NC} $worktree - No task file found"
        fi
    fi
done

echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "  git worktree remove <path>    - Remove a worktree"
echo "  git worktree prune            - Clean up worktree administrative files"
echo ""