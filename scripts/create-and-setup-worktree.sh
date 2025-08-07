#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 <task-name> [base-branch]"
    echo ""
    echo "  task-name    : Name for the task (e.g., 'fix-issue-history-model')"
    echo "  base-branch  : Base branch to branch from (default: current branch)"
    echo ""
    echo "Example:"
    echo "  $0 fix-issue-history-model"
    echo "  $0 implement-notifications main"
    echo ""
    exit 1
}

# Check arguments
if [ $# -lt 1 ]; then
    echo -e "${RED}Error: Task name is required${NC}"
    usage
fi

TASK_NAME=$1
BASE_BRANCH=${2:-$(git branch --show-current)}
REPO_DIR="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_DIR")"
WORKTREE_PATH="$(dirname "$REPO_DIR")/${REPO_NAME}-${TASK_NAME}"
BRANCH_NAME="task/$TASK_NAME"

echo -e "${BLUE}🚀 Creating Worktree for Task: $TASK_NAME${NC}"
echo "========================================"

# Validate task name
if [[ ! "$TASK_NAME" =~ ^[a-zA-Z0-9-]+$ ]]; then
    echo -e "${RED}Error: Task name can only contain letters, numbers, and hyphens${NC}"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Always fetch latest changes first
echo -e "${YELLOW}📡 Fetching latest changes...${NC}"
git fetch origin

# Check if base branch exists
if ! git show-ref --verify --quiet refs/heads/"$BASE_BRANCH" && ! git show-ref --verify --quiet refs/remotes/origin/"$BASE_BRANCH"; then
    echo -e "${RED}Error: Base branch '$BASE_BRANCH' does not exist${NC}"
    exit 1
fi

# Note: Using git's default sibling directory pattern
# No need to create parent directory - git worktree handles this

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
    echo -e "${RED}Error: Worktree already exists at $WORKTREE_PATH${NC}"
    echo "Use 'git worktree remove $WORKTREE_PATH' to remove it first"
    exit 1
fi

# Check if branch already exists
if git show-ref --verify --quiet refs/heads/"$BRANCH_NAME"; then
    echo -e "${RED}Error: Branch '$BRANCH_NAME' already exists${NC}"
    echo "Use a different task name or delete the existing branch first"
    exit 1
fi

# Create the worktree with new branch
echo -e "${YELLOW}🌿 Creating worktree and branch...${NC}"
if git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_BRANCH"; then
    echo -e "${GREEN}✓ Worktree created successfully${NC}"
else
    echo -e "${RED}Error: Failed to create worktree${NC}"
    exit 1
fi

# Change to worktree directory
cd "$WORKTREE_PATH"

# Note: Task specifications are now managed via GitHub issues
echo -e "${GREEN}✓ Worktree environment ready for GitHub issue-based tasks${NC}"

# Run the existing setup script
echo -e "${YELLOW}⚙️  Running worktree setup...${NC}"
if ./scripts/setup-worktree.sh; then
    echo -e "${GREEN}✓ Worktree setup completed successfully${NC}"
else
    echo -e "${RED}⚠️  Warning: Setup script encountered issues${NC}"
    echo "You may need to run setup manually or fix configuration issues"
fi

# Display final information
echo ""
echo -e "${BLUE}🎉 Worktree Creation Complete!${NC}"
echo "========================================"
echo -e "${BLUE}📍 Path:${NC} $WORKTREE_PATH"
echo -e "${BLUE}🌿 Branch:${NC} $BRANCH_NAME"
echo -e "${BLUE}📋 Task Management:${NC} Via GitHub issues"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "1. Use orchestrator to create GitHub issue with task specifications"
echo "2. Navigate to the worktree: cd $WORKTREE_PATH"
echo "3. Start development: npm run dev"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "  cd $WORKTREE_PATH"
echo "  npm run dev"
echo "  npm run validate"
echo "  git status"
echo ""